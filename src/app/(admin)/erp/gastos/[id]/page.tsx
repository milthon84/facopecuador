import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Tag, CreditCard, FileText, Trash2, Key, Edit, Lock, Stethoscope, GraduationCap, Building2, UploadCloud, FileImage, ExternalLink, Paperclip } from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, isMonthClosed } from "@/lib/accounting";
import { resolveExpenseArea, EXPENSE_AREA_CONFIG, resolveReceiptUrl, cleanVisibleNotes } from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";

export const dynamic = "force-dynamic";

async function voidExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();

  const { data: exp } = await supabase.from("expenses").select("expense_date").eq("id", id).single();
  if (exp?.expense_date) {
    await assertMonthOpen(exp.expense_date);
  }

  await supabase.from("expenses").update({ status: "void" }).eq("id", id);
  redirect("/erp/gastos");
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  tarjeta:       "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:       "Crédito (por pagar)",
};

export default async function GastoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/gastos");
  const canEdit = await hasWritePermission("/erp/gastos");
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: rawExpense } = await supabase
    .from("expenses")
    .select("*, bank_accounts(bank_name, account_number, notes)")
    .eq("id", id)
    .single();
  if (!rawExpense) notFound();
  const expense = rawExpense as any;

  const area = resolveExpenseArea(expense);
  const areaConfig = EXPENSE_AREA_CONFIG[area];

  const isClosed = await isMonthClosed(expense.expense_date);
  const receiptUrl = resolveReceiptUrl(expense);
  const visibleNotes = cleanVisibleNotes(expense.notes);
  const isPdf = Boolean(
    receiptUrl &&
      (receiptUrl.toLowerCase().includes(".pdf") ||
        receiptUrl.toLowerCase().includes("application/pdf"))
  );

  const dateStr = new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-EC", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/erp/gastos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink-900 truncate">{expense.supplier_name}</h1>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${areaConfig.badgeCls}`}>
              {area === "clinica" && <Stethoscope size={12} />}
              {area === "cursos" && <GraduationCap size={12} />}
              {area === "general" && <Building2 size={12} />}
              {areaConfig.label}
            </span>
          </div>
          <p className="text-xs text-ink-500 capitalize mt-0.5">{dateStr}</p>
        </div>
        {expense.status === "void" && (
          <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">Anulado</span>
        )}
      </div>

      {isClosed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 mb-4 text-xs flex items-center gap-3 shadow-xs">
          <Lock size={18} className="text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-amber-950 block">Período Contable Cerrado ({expense.expense_date.slice(0, 7)})</span>
            Este gasto pertenece a un mes cuyo período contable ha sido CERRADO. No es posible modificarlo ni anularlo.
          </div>
        </div>
      )}

      <div className="space-y-4">

        {/* Info principal */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Proveedor / Beneficiario</span>
              <p className="text-sm font-medium text-ink-900 mt-0.5">{expense.supplier_name}</p>
            </div>
            {expense.supplier_ruc && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">RUC / Cédula</span>
                <p className="text-sm font-mono text-ink-900 mt-0.5">{expense.supplier_ruc}</p>
              </div>
            )}
            {expense.document_number && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                  <FileText size={10} /> N° Comprobante
                </span>
                <p className="text-sm font-mono text-ink-900 mt-0.5">{expense.document_number}</p>
              </div>
            )}
            {expense.authorization_number && (
              <div className="col-span-2">
                <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                  <Key size={10} /> N° Autorización / Clave de Acceso SRI
                </span>
                <p className="text-sm font-mono text-ink-900 mt-0.5 break-all">{expense.authorization_number}</p>
              </div>
            )}
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Calendar size={10} /> Fecha
              </span>
              <p className="text-sm text-ink-900 mt-0.5">
                {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-EC")}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Tag size={10} /> Categoría
              </span>
              <p className="text-sm text-ink-900 mt-0.5">{expense.category}</p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <CreditCard size={10} /> Forma de pago
              </span>
              <p className="text-sm text-ink-900 mt-0.5">
                {PAYMENT_LABELS[expense.payment_method] ?? expense.payment_method}
                {expense.bank_accounts && (
                  <span className="block text-xs text-ink-500 mt-0.5">
                    {expense.bank_accounts.bank_name}
                    {expense.bank_accounts.account_number ? ` · ${expense.bank_accounts.account_number}` : ""}
                  </span>
                )}
              </p>
            </div>
            {expense.payment_reference && (
              <div className="col-span-2">
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">Referencia / Detalles de Pago</span>
                <p className="text-sm font-mono text-ink-800 mt-0.5">{expense.payment_reference}</p>
              </div>
            )}
          </div>

          {expense.description && (
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Descripción</span>
              <p className="text-sm text-ink-800 mt-0.5">{expense.description}</p>
            </div>
          )}

          {visibleNotes && (
            <div className="bg-lilac-50/70 border border-lilac-100 rounded-xl p-3">
              <span className="text-[11px] text-lilac-700 uppercase tracking-wide font-semibold">Notas</span>
              <p className="text-sm text-ink-700 mt-0.5">{visibleNotes}</p>
            </div>
          )}
        </div>

        {/* Respaldo Digital Adjunto */}
        {receiptUrl ? (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
              <div className="flex items-center gap-2">
                <Paperclip size={16} className="text-lilac-600" />
                <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
                  Respaldo Digital / Comprobante Adjunto
                </h3>
              </div>
              <a
                href={proxyStorageUrl(receiptUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-lilac-700 hover:text-lilac-900 font-semibold flex items-center gap-1 hover:underline"
              >
                <ExternalLink size={13} /> Abrir archivo original
              </a>
            </div>

            {isPdf ? (
              <div className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                    PDF
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink-900">Factura Electrónica / Comprobante PDF</p>
                    <p className="text-[11px] text-ink-400">Documento tributario respaldado</p>
                  </div>
                </div>
                <a
                  href={proxyStorageUrl(receiptUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-3.5 py-1.5 rounded-xl font-semibold shadow-xs transition"
                >
                  <ExternalLink size={13} /> Ver PDF
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-lilac-200 bg-ink-950 flex items-center justify-center max-h-80 group">
                  <img
                    src={proxyStorageUrl(receiptUrl)}
                    alt="Comprobante de gasto"
                    className="max-h-80 object-contain rounded-lg"
                  />
                  <a
                    href={proxyStorageUrl(receiptUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 bg-ink-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition"
                  >
                    <ExternalLink size={14} /> Clic para ampliar en tamaño completo
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Totales */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Resumen de montos</p>
          <div className="space-y-2 text-sm">
            {Number(expense.subtotal_0) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Subtotal IVA 0%</span>
                <span className="font-medium">${Number(expense.subtotal_0).toFixed(2)}</span>
              </div>
            )}
            {Number(expense.subtotal_15) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>Subtotal base IVA 15%</span>
                <span className="font-medium">${Number(expense.subtotal_15).toFixed(2)}</span>
              </div>
            )}
            {Number(expense.iva_amount) > 0 && (
              <div className="flex justify-between text-ink-600">
                <span>IVA 15%</span>
                <span className="font-medium">${Number(expense.iva_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-ink-900 border-t border-lilac-100 pt-2 mt-1">
              <span>TOTAL</span>
              <span className="text-red-600">${Number(expense.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Acciones de modificación y anulación (bloqueadas si el mes está cerrado) */}
        {!isClosed && canEdit && expense.status !== "void" && (
          <div className="flex items-center gap-3">
            <Link
              href={`/erp/gastos/${expense.id}/editar`}
              className="flex-1 flex items-center justify-center gap-2 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2.5 rounded-xl transition-colors font-semibold shadow-sm"
            >
              <Edit size={15} /> Editar Gasto
            </Link>
            <form action={voidExpense} className="flex-1">
              <input type="hidden" name="id" value={expense.id} />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 px-4 py-2.5 rounded-xl transition-colors font-medium"
              >
                <Trash2 size={15} /> Anular gasto
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
