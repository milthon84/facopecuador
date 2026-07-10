import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { Banknote, TrendingUp, TrendingDown, ArrowRight, X } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Transferir desde Caja General ────────────────────────────────────────

async function transferFromCajaGeneral(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/caja-general");

  const supabase   = createAdminClient();
  const caja_id    = formData.get("caja_id") as string;
  const destino_id = formData.get("destino_id") as string;
  const amount     = Number(formData.get("amount"));
  const date       = formData.get("date") as string;
  const reference  = (formData.get("reference") as string)?.trim() || null;
  const notes      = (formData.get("notes") as string)?.trim();

  if (amount <= 0) throw new Error("Monto inválido");

  // Consultar información del destino para armar el nombre real de la cuenta
  const { data: destAccount } = await supabase
    .from("bank_accounts")
    .select("bank_name, account_number, account_type")
    .eq("id", destino_id)
    .maybeSingle();

  let destino_nombre = "cuenta destino";
  if (destAccount) {
    if (destAccount.account_type === "caja") {
      destino_nombre = `Caja Chica — ${destAccount.bank_name}`;
    } else {
      destino_nombre = `${destAccount.bank_name}${destAccount.account_number ? ` · ${destAccount.account_number}` : ""}`;
    }
  }

  const descEgreso  = notes ? `Transferencia a ${destino_nombre} — ${notes}` : `Transferencia a ${destino_nombre}`;
  const descIngreso = notes ? `Transferencia desde Caja General — ${notes}` : `Transferencia desde Caja General`;

  // Egreso de Caja General
  await supabase.from("bank_transactions").insert({
    account_id:     caja_id,
    type:           "egreso",
    amount,
    date,
    description:    descEgreso,
    reference,
    payment_method: "efectivo",
    status:         "confirmado",
    origin:         "automatico",
  });

  // Ingreso en la cuenta destino (banco o caja chica)
  await supabase.from("bank_transactions").insert({
    account_id:     destino_id,
    type:           "ingreso",
    amount,
    date,
    description:    descIngreso,
    reference,
    payment_method: "efectivo",
    status:         "confirmado",
    origin:         "automatico",
  });

  redirect("/erp/caja-general");
}

// ── Page ──────────────────────────────────────────────────────────────────

type Tx = {
  id: string; type: "ingreso" | "egreso"; amount: number;
  date: string; description: string; reference: string | null;
  status: string; invoice_id: string | null;
  invoices: { invoice_number: string } | null;
};

export default async function CajaGeneralPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ action?: string }> }) {
  await assertPermission("/erp/caja-general");
  const canEdit = await hasWritePermission("/erp/caja-general");

  const searchParams = await searchParamsPromise;
  const supabase    = createAdminClient();
  const showForm    = canEdit && searchParams.action === "transferir";
  const today       = new Date().toISOString().split("T")[0];

  // Buscar la Caja General
  const { data: allCajas } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("account_type", "caja")
    .eq("is_active", true);

  const esCajaGeneral = (a: any) =>
    a.is_caja_general === true ||
    ["efectivo", "general"].some(k => (a.bank_name as string).toLowerCase().includes(k));

  const cajaGeneral = (allCajas || []).find(esCajaGeneral);
  const otrasCajas  = (allCajas || []).filter(a => a.id !== cajaGeneral?.id);

  // Otras cuentas bancarias para transferir
  const { data: bancos } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_type")
    .eq("is_active", true)
    .neq("account_type", "caja")
    .order("bank_name");

  // Movimientos de la Caja General
  let transactions: Tx[] = [];
  if (cajaGeneral) {
    const { data: txs } = await supabase
      .from("bank_transactions")
      .select("id, type, amount, date, description, reference, status, invoice_id, invoices(invoice_number)")
      .eq("account_id", cajaGeneral.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    transactions = (txs as unknown as Tx[]) || [];
  }

  // Calcular saldo
  const confirmed    = transactions.filter(t => t.status === "confirmado");
  const totalIngreso = confirmed.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const totalEgreso  = confirmed.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount, 0);
  const balance      = cajaGeneral ? r2(cajaGeneral.initial_balance + totalIngreso - totalEgreso) : 0;

  // Destinos disponibles para transferir
  const destinos = [
    ...(bancos || []).map(b => ({
      id: b.id,
      label: `${b.bank_name}${b.account_number ? ` · ${b.account_number}` : ""}`,
      tipo: "banco",
    })),
    ...otrasCajas.map(c => ({
      id: c.id,
      label: `Caja Chica — ${c.bank_name}`,
      tipo: "caja_chica",
    })),
  ];

  if (!cajaGeneral) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <Banknote size={40} className="text-lilac-300 mx-auto mb-4" />
        <p className="text-ink-500 font-medium">No hay Caja General configurada</p>
        <p className="text-sm text-ink-400 mt-1">
          Ve a <Link href="/erp/bancos" className="text-lilac-600 underline">Bancos</Link> y marca
          una cuenta tipo "Caja" como Caja General.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header + saldo */}
      <div className={`rounded-2xl p-5 mb-4 border shadow-sm ${balance > 0 ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Banknote size={18} className="text-green-600" />
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Caja General / Efectivo</p>
            </div>
            <p className={`text-4xl font-bold tabular-nums ${balance > 0 ? "text-green-800" : "text-ink-500"}`}>
              ${balance.toFixed(2)}
            </p>
            <p className="text-xs text-ink-400 mt-1">Recibe automáticamente cobros en efectivo</p>
          </div>

          {/* Botón transferir */}
          {canEdit && (
            <Link
              href={showForm ? "/erp/caja-general" : "/erp/caja-general?action=transferir"}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shrink-0 ${
                showForm
                  ? "bg-white border border-gray-200 text-ink-600 hover:bg-gray-50"
                  : "bg-green-600 hover:bg-green-700 text-white shadow-md"
              }`}>
              {showForm ? <><X size={15} /> Cancelar</> : <><ArrowRight size={15} /> Transferir</>}
            </Link>
          )}
        </div>
      </div>

      {/* Formulario de transferencia */}
      {showForm && (
        <div className="bg-white border border-green-200 rounded-2xl shadow-sm p-5 mb-5">
          <h2 className="font-semibold text-ink-900 mb-1 flex items-center gap-2 text-sm">
            <ArrowRight size={15} className="text-green-600" />
            Transferir dinero de Caja General
          </h2>
          <p className="text-xs text-ink-400 mb-4">
            Mueve el efectivo a una cuenta bancaria o a la Caja Chica.
          </p>
          <form action={transferFromCajaGeneral} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input type="hidden" name="caja_id" value={cajaGeneral.id} />

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Destino *</label>
              <select name="destino_id" required
                onChange={undefined}
                className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white">
                <option value="">— Seleccionar destino —</option>
                {destinos.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                <input type="number" name="amount" required min="0.01" step="0.01"
                  max={balance}
                  className="w-full border border-green-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono" />
              </div>
              <p className="text-[11px] text-ink-400">Disponible: ${balance.toFixed(2)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha *</label>
              <input type="date" name="date" required defaultValue={today}
                className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink-700">N° Referencia / Comprobante</label>
              <input type="text" name="reference" placeholder="Comprobante de depósito, cheque..."
                className="w-full border border-green-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white font-mono" />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Notas (opcional)</label>
              <textarea name="notes" placeholder="Notas adicionales sobre la transferencia..." rows={2}
                className="w-full border border-green-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white" />
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button type="submit"
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md">
                <ArrowRight size={16} /> Confirmar transferencia
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
          <TrendingUp size={16} className="text-green-600 shrink-0" />
          <div>
            <p className="text-[11px] text-green-700">Ingresos totales</p>
            <p className="font-bold text-green-800">${r2(totalIngreso).toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
          <TrendingDown size={16} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[11px] text-red-600">Transferido/retirado</p>
            <p className="font-bold text-red-600">${r2(totalEgreso).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lilac-50 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900 text-sm">Movimientos</h3>
          <span className="text-xs text-ink-400">{transactions.length} registros</span>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center text-ink-400 text-sm py-10">
            Sin movimientos — los cobros en efectivo aparecerán aquí automáticamente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Descripción</th>
                  <th className="px-4 py-2.5 text-left">Ref.</th>
                  <th className="px-4 py-2.5 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-lilac-50/20">
                    <td className="px-4 py-2.5 text-xs text-ink-500 whitespace-nowrap">
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-ink-800 leading-tight">{tx.description}</p>
                      {tx.invoices && (
                        <Link href={`/erp/facturacion/${tx.invoice_id}`}
                          className="text-[11px] text-lilac-600 hover:underline">
                          Factura {tx.invoices.invoice_number}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-400 font-mono">{tx.reference ?? "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${tx.type === "ingreso" ? "text-green-700" : "text-red-600"}`}>
                      {tx.type === "ingreso" ? "+" : "−"}${tx.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
