import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Tag,
  CreditCard,
  FileText,
  Trash2,
  Key,
  Edit,
  Lock,
  Stethoscope,
  GraduationCap,
  Building2,
  ExternalLink,
  Paperclip,
  Receipt,
  FileCheck2,
  CheckCircle2,
} from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, isMonthClosed } from "@/lib/accounting";
import {
  resolveExpenseArea,
  EXPENSE_AREA_CONFIG,
  resolveReceiptUrl,
  cleanVisibleNotes,
  resolveFacturaSriClave,
} from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import ComprobanteAdjuntoCard from "./ComprobanteAdjuntoCard";
import {
  ExpenseItem,
  FacturaRecibida,
  parseItemCategoryAndDesc,
  EXPENSE_CATEGORY_DETAILS,
  normalizeCategoryName,
} from "@/lib/expense-types";

export const dynamic = "force-dynamic";

async function voidExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();

  const { data: exp } = await supabase.from("expenses").select("expense_date, factura_recibida_clave_acceso").eq("id", id).single();
  if (exp?.expense_date) {
    await assertMonthOpen(exp.expense_date);
  }

  await supabase.from("expenses").update({ status: "void" }).eq("id", id);

  // Si estaba vinculada a una factura del SRI, devolverla a estado pendiente
  if (exp?.factura_recibida_clave_acceso) {
    try {
      await supabase
        .from("facturas_recibidas")
        .update({ estado_facop: "pendiente", expense_id: null })
        .eq("clave_acceso", exp.factura_recibida_clave_acceso);
    } catch (err) {
      console.warn("No se pudo desvincular factura_recibida:", err);
    }
  }

  redirect("/erp/gastos");
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:        "Efectivo",
  transferencia:   "Transferencia",
  tarjeta:         "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:         "Crédito (por pagar)",
};

export default async function GastoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/gastos");
  const canEdit = await hasWritePermission("/erp/gastos");
  const { id } = await params;
  const supabase = createAdminClient();

  let items: ExpenseItem[] = [];
  try {
    const { data: itemsData } = await supabase
      .from("expense_items")
      .select("*")
      .eq("expense_id", id)
      .order("created_at", { ascending: true });
    if (itemsData) items = itemsData as ExpenseItem[];
  } catch {
    // Si la tabla no está creada aún
  }

  const { data: rawExpense } = await supabase
    .from("expenses")
    .select("*, bank_accounts(bank_name, account_number, notes)")
    .eq("id", id)
    .single();

  if (!rawExpense) notFound();
  const expense = rawExpense as any;

  // Consultar factura SRI vinculada si existe
  let linkedFactura: FacturaRecibida | null = null;
  const clave = resolveFacturaSriClave(expense);
  if (clave && clave.length === 49) {
    try {
      const { data: fac } = await supabase
        .from("facturas_recibidas")
        .select("*")
        .eq("clave_acceso", clave)
        .maybeSingle();
      if (fac) {
        linkedFactura = fac as FacturaRecibida;
        if (linkedFactura.estado_facop !== "registrado") {
          linkedFactura.estado_facop = "registrado";
          try {
            await supabase
              .from("facturas_recibidas")
              .update({ estado_facop: "registrado", expense_id: expense.id })
              .eq("clave_acceso", clave);
          } catch (syncErr) {
            console.warn("No se pudo sincronizar estado_facop de factura recibida:", syncErr);
          }
        }
      }
    } catch {
      // Ignorar si la tabla no está disponible
    }
  }

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
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Link
          href="/erp/gastos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-ink-900 truncate">{expense.supplier_name}</h1>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${areaConfig.badgeCls}`}>
              {area === "clinica" && <Stethoscope size={12} />}
              {area === "cursos" && <GraduationCap size={12} />}
              {area === "general" && <Building2 size={12} />}
              {areaConfig.label}
            </span>
            {clave ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs">
                <CheckCircle2 size={12} className="text-emerald-600" /> Factura SRI Vinculada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                Sin Factura SRI
              </span>
            )}
          </div>
          <p className="text-xs text-ink-500 capitalize mt-0.5">{dateStr}</p>
        </div>
        {expense.status === "void" && (
          <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">Anulado</span>
        )}
      </div>

      {isClosed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-xs flex items-center gap-3 shadow-xs">
          <Lock size={18} className="text-amber-600 shrink-0" />
          <div>
            <span className="font-bold text-amber-950 block">Período Contable Cerrado ({expense.expense_date.slice(0, 7)})</span>
            Este gasto pertenece a un mes cuyo período contable ha sido CERRADO. No es posible modificarlo ni anularlo.
          </div>
        </div>
      )}

      {/* Tarjeta de Factura Recibida SRI Vinculada */}
      {linkedFactura ? (
        <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-900">Factura Electrónica SRI Vinculada</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  REGISTRADA
                </span>
              </div>
              <p className="text-[11px] text-ink-600 font-mono mt-0.5">
                N°: {linkedFactura.numero_comprobante} · Clave: {linkedFactura.clave_acceso}
              </p>
              {linkedFactura.razon_social && (
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Emisor: {linkedFactura.razon_social} (RUC: {linkedFactura.ruc_emisor})
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] text-ink-400 block">Total Factura SRI</span>
            <span className="text-sm font-bold font-mono text-emerald-950">${Number(linkedFactura.total || 0).toFixed(2)}</span>
          </div>
        </div>
      ) : clave ? (
        <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-900">Factura Electrónica SRI Vinculada</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.2 rounded-full uppercase tracking-wider">
                  Vinculada al SRI
                </span>
              </div>
              <p className="text-[11px] text-ink-600 font-mono mt-0.5 break-all">
                Clave de Acceso: {clave}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cabecera / Datos Generales */}
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
          {(clave || expense.authorization_number) && (
            <div className="col-span-2">
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Key size={10} /> Clave de Acceso SRI / N° Autorización
              </span>
              <p className="text-xs font-mono font-bold text-emerald-950 mt-0.5 break-all bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                <span>{clave || expense.authorization_number}</span>
                <span className="text-[10px] font-sans px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded font-bold shrink-0">
                  SRI REGISTRADO
                </span>
              </p>
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
            <span className="text-[11px] text-ink-400 uppercase tracking-wide">Descripción / Justificación</span>
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

      {/* Detalle de Ítems / Bienes o Servicios */}
      {items.length > 0 && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-lilac-100 pb-2">
            <FileCheck2 size={16} className="text-lilac-600" />
            <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
              Detalle de Ítems / Bienes o Servicios ({items.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-lilac-100 text-ink-400 text-[11px] font-bold uppercase tracking-wider text-left">
                  <th className="py-2 pr-2">Descripción</th>
                  <th className="py-2 px-2 text-center w-40">Categoría</th>
                  <th className="py-2 px-2 text-center w-16">Cant.</th>
                  <th className="py-2 px-2 text-right w-24">P. Unit.</th>
                  <th className="py-2 px-2 text-center w-16">IVA</th>
                  <th className="py-2 pl-2 text-right w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {items.map((it, idx) => {
                  const parsed = parseItemCategoryAndDesc(it.description);
                  const itemCat = normalizeCategoryName(it.category || parsed.category);
                  const catDetail = EXPENSE_CATEGORY_DETAILS[itemCat];
                  return (
                    <tr key={it.id || idx} className="hover:bg-lilac-50/30">
                      <td className="py-2.5 pr-2 font-medium text-ink-900">{parsed.description}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-lilac-50 text-lilac-800 border-lilac-200 cursor-help"
                          title={`${catDetail?.description || itemCat} — Contempla: ${catDetail?.examples || ""}`}
                        >
                          {itemCat}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-ink-700">{Number(it.quantity)}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-ink-700">${Number(it.unit_price).toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                          Number(it.iva_rate) > 0 ? "bg-lilac-100 text-lilac-800" : "bg-gray-100 text-gray-700"
                        }`}>
                          {Number(it.iva_rate)}%
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono font-bold text-ink-900">
                        ${Number(it.subtotal).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Respaldo Digital Adjunto */}
      {receiptUrl && (
        <ComprobanteAdjuntoCard receiptUrl={receiptUrl} />
      )}

      {/* Totales */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5">
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Resumen de montos</p>
        <div className="space-y-2 text-sm">
          {Number(expense.subtotal_0) > 0 && (
            <div className="flex justify-between text-ink-600">
              <span>Subtotal IVA 0%</span>
              <span className="font-medium font-mono">${Number(expense.subtotal_0).toFixed(2)}</span>
            </div>
          )}
          {Number(expense.subtotal_15) > 0 && (
            <div className="flex justify-between text-ink-600">
              <span>Subtotal base IVA 15%</span>
              <span className="font-medium font-mono">${Number(expense.subtotal_15).toFixed(2)}</span>
            </div>
          )}
          {Number(expense.iva_amount) > 0 && (
            <div className="flex justify-between text-ink-600">
              <span>IVA 15%</span>
              <span className="font-medium font-mono">${Number(expense.iva_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base text-ink-900 border-t border-lilac-100 pt-2 mt-1">
            <span>TOTAL</span>
            <span className="text-red-600 font-mono text-lg font-black">${Number(expense.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Acciones de modificación y anulación */}
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
  );
}
