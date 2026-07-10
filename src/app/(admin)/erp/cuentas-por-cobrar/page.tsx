import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { CircleDollarSign, CheckCircle2, Clock, AlertCircle, FileText, Zap } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const r2  = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PM_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia",
  cheque: "Cheque", tarjeta_debito: "T. Débito", tarjeta_credito: "T. Crédito",
};

// ── Confirmar cobro completo con 1 clic ───────────────────────────────────

async function confirmFullPayment(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cuentas-por-cobrar");

  const supabase       = createAdminClient();
  const invoice_id     = formData.get("invoice_id") as string;
  const amount         = r2(Number(formData.get("amount")));
  const payment_method = (formData.get("payment_method") as string) || "efectivo";
  const comprobante_ref = (formData.get("comprobante_ref") as string)?.trim() || null;
  const today          = new Date().toISOString().split("T")[0];
  const bank_account_id = (formData.get("bank_account_id") as string) || null;

  // Insertar pago completo
  await supabase.from("invoice_payments").insert({
    invoice_id, amount, payment_date: today,
    payment_method, bank_account_id: bank_account_id || null,
    reference: comprobante_ref, notes: "Confirmado desde cuentas por cobrar",
  });

  // Marcar factura como pagada
  await supabase.from("invoices").update({ payment_status: "paid" }).eq("id", invoice_id);

  const { data: inv } = await supabase
    .from("invoices").select("invoice_number, client_name").eq("id", invoice_id).single();

  if (bank_account_id) {
    // Transferencia/Tarjeta → cuenta bancaria seleccionada
    await supabase.from("bank_transactions").insert({
      account_id: bank_account_id, type: "ingreso", amount, date: today,
      description: `Cobro Factura ${inv?.invoice_number} — ${inv?.client_name}`,
      reference: comprobante_ref, payment_method,
      invoice_id, status: "confirmado", origin: "automatico",
    }).then(() => {});
  } else if (payment_method === "efectivo") {
    // Efectivo → Caja General automáticamente
    const { data: cajaGeneral } = await supabase
      .from("bank_accounts").select("id")
      .eq("is_caja_general", true).eq("is_active", true).maybeSingle();
    if (cajaGeneral) {
      await supabase.from("bank_transactions").insert({
        account_id: cajaGeneral.id, type: "ingreso", amount, date: today,
        description: `Cobro efectivo Factura ${inv?.invoice_number} — ${inv?.client_name}`,
        payment_method: "efectivo", invoice_id,
        status: "confirmado", origin: "automatico",
      }).then(() => {});
    }
  }

  redirect("/erp/cuentas-por-cobrar");
}

// ── Registrar pago parcial ────────────────────────────────────────────────

async function recordPartialPayment(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/cuentas-por-cobrar");

  const supabase       = createAdminClient();
  const invoice_id     = formData.get("invoice_id") as string;
  const amount         = r2(Number(formData.get("amount")));
  const payment_method = (formData.get("payment_method") as string) || "efectivo";
  const comprobante_ref = (formData.get("comprobante_ref") as string)?.trim() || null;
  const payment_date   = (formData.get("payment_date") as string) || new Date().toISOString().split("T")[0];
  const bank_account_id = (formData.get("bank_account_id") as string) || null;

  if (amount <= 0) throw new Error("Monto inválido");

  // Obtener total ya pagado + total de la factura
  const [{ data: invoice }, { data: prevPayments }] = await Promise.all([
    supabase.from("invoices").select("total, invoice_number, client_name").eq("id", invoice_id).single(),
    supabase.from("invoice_payments").select("amount").eq("invoice_id", invoice_id),
  ]);
  if (!invoice) throw new Error("Factura no encontrada");

  const totalPaid = r2((prevPayments || []).reduce((s, p) => s + Number(p.amount), 0) + amount);
  const newStatus = totalPaid >= Number(invoice.total) ? "paid" : "partial";

  await supabase.from("invoice_payments").insert({
    invoice_id, amount, payment_date, payment_method,
    bank_account_id: bank_account_id || null, reference: comprobante_ref,
  });
  await supabase.from("invoices").update({ payment_status: newStatus }).eq("id", invoice_id);

  if (bank_account_id) {
    await supabase.from("bank_transactions").insert({
      account_id: bank_account_id, type: "ingreso", amount, date: payment_date,
      description: `Cobro parcial Factura ${invoice.invoice_number} — ${invoice.client_name}`,
      reference: comprobante_ref, payment_method,
      invoice_id, status: "confirmado", origin: "automatico",
    }).then(() => {});
  }

  redirect("/erp/cuentas-por-cobrar");
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CuentasPorCobrarPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ pay?: string }> }) {
  await assertPermission("/erp/cuentas-por-cobrar");
  const canEdit = await hasWritePermission("/erp/cuentas-por-cobrar");

  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  const [{ data: invoices }, { data: allPayments }, { data: bankAccounts }] = await Promise.all([
    supabase.from("invoices")
      .select("id, invoice_number, client_name, client_document, issue_date, total, payment_status, payment_method, sri_status")
      .in("payment_status", ["pending", "partial"])
      .order("issue_date", { ascending: true }),
    supabase.from("invoice_payments").select("invoice_id, amount"),
    supabase.from("bank_accounts").select("id, bank_name, account_number, account_type").eq("is_active", true).order("bank_name"),
  ]);

  const paidMap = new Map<string, number>();
  (allPayments || []).forEach(p => {
    paidMap.set(p.invoice_id, r2((paidMap.get(p.invoice_id) ?? 0) + Number(p.amount)));
  });

  const list = (invoices || []).map(inv => ({
    ...inv,
    total_num: Number(inv.total),
    paid:    paidMap.get(inv.id) ?? 0,
    pending: r2(Number(inv.total) - (paidMap.get(inv.id) ?? 0)),
  }));

  const totalPendiente = r2(list.reduce((s, i) => s + i.pending, 0));
  const selectedId     = canEdit ? (searchParams.pay ?? null) : null;
  const today          = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <CircleDollarSign className="text-green-600" /> Cuentas por Cobrar
          </h1>
          <p className="text-sm text-ink-600">
            Solo aparecen facturas a crédito o transferencia pendiente de confirmación.
            <span className="ml-1 text-green-600 font-medium">Efectivo se cobra automáticamente.</span>
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-ink-500">Total por cobrar</span>
          <span className="text-2xl font-bold text-green-700">${fmt(totalPendiente)}</span>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-5 flex items-start gap-3">
        <Zap size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <strong>Flujo rápido:</strong> Haz clic en <strong>"✓ Cobrado"</strong> para confirmar el pago completo con un clic.
          Opcionalmente sube el número de comprobante. Para cobros parciales usa <strong>"Parcial"</strong>.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-12 text-center">
          <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
          <p className="text-ink-500 font-medium">¡Todo cobrado!</p>
          <p className="text-sm text-ink-400 mt-1">No hay facturas pendientes de cobro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(inv => {
            const isSelected = inv.id === selectedId;
            return (
              <div key={inv.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden transition-all ${isSelected ? "border-green-300 shadow-green-100 shadow-md" : "border-lilac-100"}`}>
                {/* Fila principal */}
                <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/erp/facturacion/${inv.id}`}
                        className="font-mono text-xs text-lilac-600 hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        inv.payment_status === "partial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {inv.payment_status === "partial" ? <><Clock size={10} className="inline mr-0.5" />Parcial</> : <><AlertCircle size={10} className="inline mr-0.5" />Pendiente</>}
                      </span>
                    </div>
                    <p className="font-semibold text-ink-900 mt-0.5">{inv.client_name}</p>
                    <p className="text-xs text-ink-400">{inv.client_document} · {new Date(inv.issue_date + "T12:00:00").toLocaleDateString("es-EC")}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-ink-400">Total factura</p>
                    <p className="font-bold text-ink-900 text-lg">${fmt(inv.total_num)}</p>
                    {inv.paid > 0 && <p className="text-xs text-green-600">Abonado: ${fmt(inv.paid)}</p>}
                    <p className="text-sm font-bold text-amber-700">Pendiente: ${fmt(inv.pending)}</p>
                  </div>

                  {/* Botones de acción */}
                  {canEdit && (
                    <div className="flex gap-2 shrink-0">
                      {/* Confirmar pago completo en 1 clic */}
                      <form action={confirmFullPayment}>
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <input type="hidden" name="amount" value={inv.pending} />
                        <input type="hidden" name="payment_method" value={inv.payment_method ?? "efectivo"} />
                        <button type="submit"
                          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm">
                          <CheckCircle2 size={15} /> Cobrado
                        </button>
                      </form>

                      {/* Abrir formulario extendido */}
                      <Link
                        href={`/erp/cuentas-por-cobrar?pay=${inv.id}`}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-colors border ${
                          isSelected
                            ? "bg-lilac-600 text-white border-lilac-600"
                            : "bg-white text-lilac-700 border-lilac-200 hover:bg-lilac-50"
                        }`}
                      >
                        <FileText size={14} /> Detalle
                      </Link>
                    </div>
                  )}
                </div>

                {/* Panel extendido — comprobante y cobro parcial */}
                {isSelected && (
                  <div className="border-t border-green-100 bg-green-50/30 px-5 py-4 grid sm:grid-cols-2 gap-6">
                    {/* Confirmación rápida con comprobante */}
                    <div>
                      <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <CheckCircle2 size={15} /> Confirmar cobro completo (${fmt(inv.pending)})
                      </h3>
                      <form action={confirmFullPayment} className="space-y-3">
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <input type="hidden" name="amount" value={inv.pending} />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">Método</label>
                            <select name="payment_method" defaultValue={inv.payment_method ?? "efectivo"}
                              className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              
                              
                              <option value="tarjeta_credito">Tarjeta Crédito</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">N° Comprobante</label>
                            <input name="comprobante_ref" placeholder="Ref. transferencia, cheque..."
                              className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 font-mono" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-ink-700">Cuenta bancaria destino (opcional)</label>
                          <select name="bank_account_id"
                            className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400">
                            <option value="">— Sin registrar en banco —</option>
                            {(bankAccounts || []).filter(b => b.account_type !== "caja").map(b => (
                              <option key={b.id} value={b.id}>
                                {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button type="submit"
                          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-md">
                          <CheckCircle2 size={16} /> Confirmar cobro completo — ${fmt(inv.pending)}
                        </button>
                      </form>
                    </div>

                    {/* Cobro parcial */}
                    <div>
                      <h3 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-2">
                        <Clock size={15} /> Registrar abono parcial
                      </h3>
                      <form action={recordPartialPayment} className="space-y-3">
                        <input type="hidden" name="invoice_id" value={inv.id} />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">Monto a abonar *</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                              <input type="number" name="amount" required min="0.01" step="0.01"
                                max={inv.pending}
                                className="w-full border border-lilac-200 rounded-xl pl-7 pr-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 font-mono" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">Fecha</label>
                            <input type="date" name="payment_date" defaultValue={today}
                              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">Método</label>
                            <select name="payment_method"
                              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400">
                              <option value="efectivo">Efectivo</option>
                              <option value="transferencia">Transferencia</option>
                              
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-ink-700">Comprobante</label>
                            <input name="comprobante_ref" placeholder="N° ref."
                              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 font-mono" />
                          </div>
                        </div>
                        <button type="submit"
                          className="w-full flex items-center justify-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
                          Registrar abono parcial
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
