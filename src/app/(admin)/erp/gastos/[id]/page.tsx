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
  Clock,
} from "lucide-react";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, isMonthClosed, syncExpenseJournalEntries } from "@/lib/accounting";
import {
  resolveExpenseArea,
  EXPENSE_AREA_CONFIG,
  resolveReceiptUrl,
  resolvePaymentReceiptUrl,
  cleanVisibleNotes,
  resolveFacturaSriClave,
  resolveExpenseAuthorization,
  cleanExpenseDescription,
  resolveExpenseDocType,
  cleanDocNumberOnly,
  formatExpenseDocNumber,
} from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import ComprobanteAdjuntoCard from "./ComprobanteAdjuntoCard";
import AsientoContableModal from "./AsientoContableModal";
import ComprobanteModalButton from "./ComprobanteModalButton";
import { JournalEntryItem } from "./AsientoContableGastoCard";
import {
  ExpenseItem,
  FacturaRecibida,
  parseItemCategoryAndDesc,
  EXPENSE_CATEGORY_DETAILS,
  normalizeCategoryName,
  resolveExpenseItemCategoryDetail,
} from "@/lib/expense-types";
import { deleteOrVoidExpense } from "../actions";

export const dynamic = "force-dynamic";

async function voidExpense(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await deleteOrVoidExpense(id);
  redirect("/erp/gastos");
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:        "Efectivo (Caja Chica)",
  transferencia:   "Transferencia Bancaria",
  tarjeta:         "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:         "Cuentas por Pagar Proveedores (Pendiente de Pago)",
  prestamo_accionistas: "Préstamo Accionistas (Pasivo 2.1.05.01)",
};

const DOC_TYPE_CONFIG: Record<
  "factura" | "nota_venta" | "sin_documento",
  {
    name: string;
    subLabel: string;
    badgeCls: string;
    fullDesc: string;
  }
> = {
  factura: {
    name: "Factura",
    subLabel: "Factura con valor tributario",
    badgeCls: "bg-blue-100 text-blue-900 border-blue-200",
    fullDesc: "Comprobante autorizado con desglose de IVA y crédito fiscal.",
  },
  nota_venta: {
    name: "Nota de Venta",
    subLabel: "Régimen RIMPE Negocio Popular",
    badgeCls: "bg-amber-100 text-amber-900 border-amber-200",
    fullDesc: "Emitida por contribuyente negocio popular (sin desglose de IVA).",
  },
  sin_documento: {
    name: "Gasto Directo",
    subLabel: "Sin Comprobante Fiscal / Recibo Simple",
    badgeCls: "bg-purple-100 text-purple-900 border-purple-200",
    fullDesc: "Desembolso interno sustentado mediante recibo o comprobante simple.",
  },
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
  let clave = resolveFacturaSriClave(expense);
  const resolvedAuthNumber = clave || resolveExpenseAuthorization(expense);

  // 1. Por clave de acceso SRI
  if (clave && clave.length === 49) {
    try {
      const { data: fac } = await supabase
        .from("facturas_recibidas")
        .select("*")
        .eq("clave_acceso", clave)
        .maybeSingle();
      if (fac) {
        linkedFactura = fac as FacturaRecibida;
      }
    } catch {
      // Ignorar si la tabla no está disponible
    }
  }

  // 2. Por expense_id en facturas_recibidas
  if (!linkedFactura) {
    try {
      const { data: facByExp } = await supabase
        .from("facturas_recibidas")
        .select("*")
        .eq("expense_id", id)
        .maybeSingle();
      if (facByExp) {
        linkedFactura = facByExp as FacturaRecibida;
        if (!clave && linkedFactura.clave_acceso) {
          clave = linkedFactura.clave_acceso;
        }
      }
    } catch {
      // Ignorar
    }
  }

  // 3. Por número de comprobante si coincide
  if (!linkedFactura && expense.document_number) {
    try {
      const cleanNum = cleanDocNumberOnly(expense.document_number);
      if (cleanNum) {
        const { data: facByNum } = await supabase
          .from("facturas_recibidas")
          .select("*")
          .ilike("numero_comprobante", `%${cleanNum}%`)
          .maybeSingle();
        if (facByNum) {
          linkedFactura = facByNum as FacturaRecibida;
          if (!clave && linkedFactura.clave_acceso) {
            clave = linkedFactura.clave_acceso;
          }
        }
      }
    } catch {
      // Ignorar
    }
  }

  if (linkedFactura && clave) {
    if (linkedFactura.estado_facop !== "registrado" || linkedFactura.expense_id !== expense.id) {
      linkedFactura.estado_facop = "registrado";
      linkedFactura.expense_id = expense.id;
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

  const area = resolveExpenseArea(expense);
  const areaConfig = EXPENSE_AREA_CONFIG[area];
  const docType = resolveExpenseDocType(expense);
  const docTypeInfo = DOC_TYPE_CONFIG[docType] || DOC_TYPE_CONFIG.factura;

  const displayItems: ExpenseItem[] = items.length > 0 ? items : [
    {
      id: "main-item",
      description: expense.description || `Concepto principal de gasto - ${expense.category}`,
      category: expense.category,
      quantity: 1,
      unit_price: Number(expense.subtotal_0 || 0) + Number(expense.subtotal_15 || 0) > 0
        ? Number(expense.subtotal_0 || 0) + Number(expense.subtotal_15 || 0)
        : Number(expense.total),
      subtotal: Number(expense.subtotal_0 || 0) + Number(expense.subtotal_15 || 0) > 0
        ? Number(expense.subtotal_0 || 0) + Number(expense.subtotal_15 || 0)
        : Number(expense.total),
      iva_rate: Number(expense.iva_amount) > 0 ? 15 : 0,
      iva_amount: Number(expense.iva_amount || 0),
      total: Number(expense.total),
    },
  ];

  const isClosed = await isMonthClosed(expense.expense_date);
  const receiptUrl = resolveReceiptUrl(expense);
  const paymentReceiptUrl = resolvePaymentReceiptUrl(expense);
  const visibleNotes = cleanVisibleNotes(expense.notes);

  // Consultar asientos contables registrados para este gasto (Causación y Pago si existe)
  let journalEntries: JournalEntryItem[] = [];
  try {
    const { data: rawEntries } = await supabase
      .from("journal_entries")
      .select(`
        id,
        entry_number,
        entry_code,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        created_at,
        journal_lines (
          id,
          account_code,
          account_name,
          debit,
          credit,
          description
        )
      `)
      .eq("reference_type", "expense")
      .eq("reference_id", id)
      .order("created_at", { ascending: true });

    if (rawEntries && rawEntries.length > 0) {
      journalEntries = rawEntries as any[];
    }
  } catch (jErr) {
    console.warn("No se pudieron consultar asientos de journal_entries:", jErr);
  }

  // Si no hay asientos físicos en journal_entries (gastos previos), sincronizar y persistir automáticamente
  if (journalEntries.length === 0 && expense.status === "registered") {
    try {
      await syncExpenseJournalEntries(id);
      const { data: refreshed } = await supabase
        .from("journal_entries")
        .select(`
          id,
          entry_number,
          entry_code,
          entry_date,
          description,
          reference_type,
          reference_id,
          status,
          created_at,
          journal_lines (
            id,
            account_code,
            account_name,
            debit,
            credit,
            description
          )
        `)
        .eq("reference_type", "expense")
        .eq("reference_id", id)
        .order("created_at", { ascending: true });
      if (refreshed && refreshed.length > 0) {
        journalEntries = refreshed as any[];
      }
    } catch (syncErr) {
      console.warn("No se pudo auto-sincronizar asiento de gasto en detalle:", syncErr);
    }
  }

  // Fallback de proyección si aún no hay registros
  if (journalEntries.length === 0) {
    const subtotalTotal = Number(expense.subtotal_0 || 0) + Number(expense.subtotal_15 || 0);
    const ivaAmt = Number(expense.iva_amount || 0);
    const tot = Number(expense.total || 0);

    const projectedLines: any[] = [];
    if (items.length > 0) {
      for (const it of items) {
        const itDetail = resolveExpenseItemCategoryDetail(
          it.category || expense.category,
          it.account_code || expense.account_code,
          it.account_name || expense.account_name
        );
        projectedLines.push({
          account_code: it.account_code || itDetail.accountCode || expense.account_code || "5.2.05.01",
          account_name: it.account_name || itDetail.name || expense.account_name || "Gasto Operacional",
          debit: Number(it.subtotal || 0),
          credit: 0,
          description: it.description || cleanExpenseDescription(expense.description) || expense.supplier_name,
        });
      }
    } else {
      const expDetail = resolveExpenseItemCategoryDetail(
        expense.category,
        expense.account_code,
        expense.account_name
      );
      projectedLines.push({
        account_code: expense.account_code || expDetail.accountCode || "5.2.05.01",
        account_name: expense.account_name || expDetail.name || "Gasto Operacional",
        debit: subtotalTotal > 0 ? subtotalTotal : tot,
        credit: 0,
        description: cleanExpenseDescription(expense.description) || expense.supplier_name,
      });
    }

    if (ivaAmt > 0) {
      projectedLines.push({
        account_code: "1.1.03.01",
        account_name: "Crédito Tributario IVA",
        debit: ivaAmt,
        credit: 0,
      });
    }

    projectedLines.push({
      account_code: "2.1.01.01",
      account_name: "Cuentas por Pagar Proveedores",
      debit: 0,
      credit: tot,
      description: expense.supplier_name,
    });

    journalEntries.push({
      id: "proj-causacion",
      entry_date: expense.expense_date,
      description: `Causación Compra — ${expense.category} — ${expense.supplier_name}`,
      reference_type: "expense",
      reference_id: expense.id,
      journal_lines: projectedLines,
    });

    // Si ya fue pagado
    if (expense.payment_method && expense.payment_method !== "credito") {
      let payCode = "1.1.01.03";
      let payName = "Bancos Cuentas Corrientes y Ahorros";
      if (expense.payment_method === "efectivo") {
        payCode = "1.1.01.02";
        payName = "Caja Chica";
      } else if (expense.payment_method === "prestamo_accionistas") {
        payCode = "2.1.05.01";
        payName = "Préstamos Accionistas por Pagar";
      }
      journalEntries.push({
        id: "proj-pago",
        entry_date: expense.expense_date,
        description: expense.payment_method === "prestamo_accionistas"
          ? `Cruce Pasivo Préstamo Accionistas — ${expense.supplier_name}`
          : `Pago / Cruce Bancario — ${expense.supplier_name} (${payName})`,
        reference_type: "expense",
        reference_id: expense.id,
        journal_lines: [
          {
            account_code: "2.1.01.01",
            account_name: "Cuentas por Pagar Proveedores",
            debit: tot,
            credit: 0,
            description: `Cancelación cta. por pagar — ${expense.supplier_name}`,
          },
          {
            account_code: payCode,
            account_name: payName,
            debit: 0,
            credit: tot,
            description: expense.payment_method === "prestamo_accionistas"
              ? `Préstamo Accionistas por Pagar`
              : `Salida de fondos (${expense.payment_method})`,
          },
        ],
      });
    }
  }

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
      {/* Encabezado con Botones de Ver Asiento y Ver Comprobantes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
              {clave ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Factura SRI Vinculada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                  Sin Factura SRI
                </span>
              )}

              {/* Estado de Pago */}
              {expense.payment_method === "credito" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-300 shadow-2xs">
                  <Clock size={12} className="text-amber-600" /> Pendiente de Pago
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs">
                  <CheckCircle2 size={12} className="text-emerald-600" /> Pagada
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 capitalize mt-0.5">{dateStr}</p>
          </div>
        </div>

        {/* Botón de Acción Superior: Ver Asiento Contable */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center sm:ml-auto">
          {expense.status === "void" && (
            <span className="text-xs font-bold bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
              Anulado
            </span>
          )}

          <AsientoContableModal
            entries={journalEntries}
            expenseTotal={Number(expense.total)}
            buttonText="Ver Asiento"
          />
        </div>
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

      {/* Cabecera / Datos Generales */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 space-y-4 relative">
        {/* Botón de Comprobante Adjunto (Solo el icono de Clip en la esquina superior derecha) */}
        {(receiptUrl || paymentReceiptUrl) && (
          <div className="absolute top-4 right-4 z-10">
            <ComprobanteModalButton
              receiptUrl={receiptUrl}
              paymentReceiptUrl={paymentReceiptUrl}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-12">
          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide">Proveedor / Beneficiario</span>
            <p className="text-sm font-bold text-ink-900 mt-0.5">{expense.supplier_name}</p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide">RUC / Cédula</span>
            <p className="text-sm font-mono font-medium text-ink-900 mt-0.5">
              {expense.supplier_ruc || "Sin RUC registrado"}
            </p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              <FileText size={11} className="text-lilac-600" /> Tipo de Comprobante
            </span>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-lg border ${docTypeInfo.badgeCls}`}>
                {docTypeInfo.name}
              </span>
              <span className="text-xs text-ink-500 font-medium">({docTypeInfo.subLabel})</span>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              <FileCheck2 size={11} className="text-lilac-600" /> N° Comprobante / Secuencial
            </span>
            <p className="text-sm font-mono font-bold text-ink-900 mt-0.5">
              {formatExpenseDocNumber(expense) || cleanDocNumberOnly(expense.document_number) || "Sin número (Gasto Directo)"}
            </p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              <Calendar size={11} className="text-lilac-600" /> Fecha de Emisión
            </span>
            <p className="text-sm font-medium text-ink-900 mt-0.5">
              {new Date(expense.expense_date + "T12:00:00").toLocaleDateString("es-EC")}
            </p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              {area === "clinica" && <Stethoscope size={11} className="text-teal-600" />}
              {area === "cursos" && <GraduationCap size={11} className="text-indigo-600" />}
              {area === "general" && <Building2 size={11} className="text-amber-600" />}
              Centro de Costo / Destino
            </span>
            <p className="text-sm font-bold text-ink-900 mt-0.5 flex items-center gap-2">
              <span>{areaConfig.label}</span>
              <span className="text-[11px] font-normal text-ink-500">({areaConfig.description})</span>
            </p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              <Tag size={11} className="text-lilac-600" /> Categoría Contable Principal
            </span>
            <p className="text-sm font-semibold text-ink-900 mt-0.5">{expense.category}</p>
          </div>

          <div>
            <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
              <CreditCard size={11} className="text-lilac-600" /> Forma de Pago / Estado de Cancelación
            </span>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-ink-900">
                {PAYMENT_LABELS[expense.payment_method] ?? expense.payment_method}
                {expense.bank_accounts && (
                  <span className="block text-xs text-ink-500 mt-0.5 font-normal">
                    {expense.bank_accounts.bank_name}
                    {expense.bank_accounts.account_number ? ` · Cta: ${expense.bank_accounts.account_number}` : ""}
                  </span>
                )}
              </p>
              {expense.payment_method === "credito" && canEdit && !isClosed && (
                <Link
                  href={`/erp/gastos/${expense.id}/editar`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <CreditCard size={12} /> Registrar Pago / Cruce
                </Link>
              )}
            </div>
          </div>

          {expense.payment_reference && (
            <div className="col-span-1 sm:col-span-2">
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Referencia / Comprobante de Pago / Voucher</span>
              <p className="text-sm font-mono font-medium text-ink-800 mt-0.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 inline-block">
                {expense.payment_reference}
              </p>
            </div>
          )}

          {resolvedAuthNumber && (
            <div className="col-span-1 sm:col-span-2">
              <span className="text-[11px] text-ink-400 uppercase tracking-wide flex items-center gap-1">
                <Key size={11} className="text-emerald-600" /> Clave de Acceso SRI / N° Autorización
              </span>
              <p className="text-xs font-mono font-bold text-emerald-950 mt-1 break-all bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                <span>{resolvedAuthNumber}</span>
                {resolvedAuthNumber.length === 49 ? (
                  <span className="text-[10px] font-sans px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-bold shrink-0">
                    SRI REGISTRADO
                  </span>
                ) : (
                  <span className="text-[10px] font-sans px-2 py-0.5 bg-lilac-200 text-lilac-900 rounded font-bold shrink-0">
                    AUT. FÍSICA
                  </span>
                )}
              </p>
            </div>
          )}

          {expense.created_by_email && (
            <div className="col-span-1 sm:col-span-2 text-xs text-ink-400 pt-1 border-t border-lilac-50 flex items-center justify-between flex-wrap gap-1">
              <span>Registrado por: <strong className="text-ink-600">{expense.created_by_email}</strong></span>
              {expense.created_at && (
                <span>Fecha registro: {new Date(expense.created_at).toLocaleString("es-EC")}</span>
              )}
            </div>
          )}
        </div>

        {cleanExpenseDescription(expense.description) && (
          <div className="pt-2 border-t border-lilac-50">
            <span className="text-[11px] text-ink-400 uppercase tracking-wide">Descripción / Justificación</span>
            <p className="text-sm text-ink-800 mt-0.5 bg-lilac-50/40 p-2.5 rounded-xl border border-lilac-100">
              {cleanExpenseDescription(expense.description)}
            </p>
          </div>
        )}

        {visibleNotes && (
          <div className="bg-lilac-50/70 border border-lilac-100 rounded-xl p-3">
            <span className="text-[11px] text-lilac-700 uppercase tracking-wide font-semibold">Notas Adicionales</span>
            <p className="text-sm text-ink-700 mt-0.5">{visibleNotes}</p>
          </div>
        )}
      </div>

      {/* Detalle de Ítems / Bienes o Servicios */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-lilac-100 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} className="text-lilac-600" />
            <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wide">
              Detalle de Ítems / Bienes o Servicios ({displayItems.length})
            </h3>
          </div>
          {items.length === 0 ? (
            <span className="text-[10px] text-lilac-700 font-semibold bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-md">
              Concepto único registrado
            </span>
          ) : (
            <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              Ítems desglosados
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-lilac-100 text-ink-400 text-[11px] font-bold uppercase tracking-wider text-left">
                <th className="py-2 pr-2">Descripción / Concepto</th>
                <th className="py-2 px-2 text-center w-44">Categoría Contable</th>
                <th className="py-2 px-2 text-center w-16">Cant.</th>
                <th className="py-2 px-2 text-right w-24">P. Unit.</th>
                <th className="py-2 px-2 text-center w-16">IVA</th>
                <th className="py-2 pl-2 text-right w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {displayItems.map((it, idx) => {
                const parsed = parseItemCategoryAndDesc(it.description);
                // Categoría contable y cuenta contable efectiva
                const rawCategory = it.category || parsed.category || expense.category || it.account_name || expense.account_name || "";
                const catDetail = resolveExpenseItemCategoryDetail(
                  rawCategory,
                  it.account_code || expense.account_code,
                  it.account_name || expense.account_name
                );
                const itemCat = catDetail.name || normalizeCategoryName(rawCategory) || "Gasto Operacional";

                // Resolución de descripción del concepto
                const cleanExpDesc = cleanExpenseDescription(expense.description);
                const itDesc = parsed.description?.trim();
                const isGenericItemDesc =
                  !itDesc ||
                  itDesc.toLowerCase().includes("compra según") ||
                  itDesc.toLowerCase().includes("factura electrónica") ||
                  itDesc.toLowerCase() === "item de gasto" ||
                  itDesc.toLowerCase().startsWith("concepto principal") ||
                  Boolean(expense.supplier_name && itDesc.toLowerCase().includes(expense.supplier_name.toLowerCase().slice(0, 8)));

                const mainDesc = (cleanExpDesc && (isGenericItemDesc || displayItems.length === 1))
                  ? cleanExpDesc
                  : (itDesc || cleanExpDesc || "Gasto registrado");

                const secondaryDesc = (itDesc && itDesc !== mainDesc && !isGenericItemDesc)
                  ? itDesc
                  : (cleanExpDesc && cleanExpDesc !== mainDesc ? cleanExpDesc : null);

                return (
                  <tr key={it.id || idx} className="hover:bg-lilac-50/30">
                    <td className="py-2.5 pr-2">
                      <div className="font-semibold text-ink-900">{mainDesc}</div>
                      {secondaryDesc && (
                        <div className="text-[11px] text-ink-500 mt-0.5">{secondaryDesc}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-lilac-50 text-lilac-800 border-lilac-200 cursor-help"
                        title={`${catDetail?.description || itemCat}`}
                      >
                        {itemCat}
                      </span>
                      {catDetail?.accountCode && (
                        <span className="block text-[9px] font-mono text-ink-400 mt-0.5">
                          Cta: {catDetail.accountCode}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono text-ink-700">{Number(it.quantity || 1)}</td>
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
              <Trash2 size={15} /> Eliminar / Anular gasto
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
