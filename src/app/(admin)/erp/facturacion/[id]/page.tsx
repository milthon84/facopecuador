import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock,
  User, FileText, Hash, CreditCard, RefreshCw, Printer, Trash2, Building2, ExternalLink
} from "lucide-react";
import CopyButton from "@/components/CopyButton";
import ReintentoSriButton from "@/components/ReintentoSriButton";
import AnularFacturaButton from "@/components/AnularFacturaButton";
import EmitirNotaCreditoModal from "@/components/EmitirNotaCreditoModal";
import SyncNotaCreditoButton from "@/components/SyncNotaCreditoButton";
import InvoicePhotosSection, { InvoicePhoto } from "@/components/InvoicePhotosSection";
import AsientoContableModal, { JournalEntryItem, JournalLineItem } from "@/components/AsientoContableModal";
import { getTipoIdentificacion } from "@/lib/sri";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

function StatusBadge({ status, env }: { status: string; env?: string }) {
  const isProd = env === "2";
  const authLabel = env ? `Autorizado (${isProd ? "Producción" : "Pruebas"})` : "Autorizado";
  
  const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    authorized: { bg: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 size={14} />, label: authLabel },
    rejected:   { bg: "bg-red-100 text-red-700 border-red-200",       icon: <XCircle size={14} />,      label: "Rechazado"  },
    error:      { bg: "bg-red-100 text-red-700 border-red-200",       icon: <AlertCircle size={14} />,  label: "Error"      },
    submitted:  { bg: "bg-blue-100 text-blue-700 border-blue-200",    icon: <Clock size={14} />,        label: "Enviado"    },
    draft:      { bg: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock size={14} />,        label: "Borrador"   },
    cancelled:  { bg: "bg-slate-100 text-slate-700 border-slate-200",  icon: <XCircle size={14} />,      label: "Anulado"    },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    paid:      { bg: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 size={14} />, label: "Cobrado" },
    partial:   { bg: "bg-blue-100 text-blue-700 border-blue-200",   icon: <Clock size={14} />,        label: "Cobro Parcial" },
    pending:   { bg: "bg-amber-100 text-amber-700 border-amber-200",icon: <Clock size={14} />,        label: "Por Cobrar" },
    cancelled: { bg: "bg-slate-100 text-slate-700 border-slate-200",  icon: <XCircle size={14} />,      label: "Anulado" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${s.bg}`}>
      {s.icon}{s.label}
    </span>
  );
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo:        "Efectivo",
  transferencia:   "Transferencia",
  cheque:          "Cheque",
  tarjeta_debito:  "Tarjeta Débito",
  tarjeta_credito: "Tarjeta Crédito",
};

function getDocumentLabel(doc: string): string {
  const code = getTipoIdentificacion(doc);
  if (code === "04") return "RUC";
  if (code === "05") return "Cédula";
  if (code === "06") return "Pasaporte";
  if (code === "08") return "Identificación Ext.";
  return "Documento";
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertPermission("/erp/facturacion");
  const canEdit = await hasWritePermission("/erp/facturacion");

  const supabase = createAdminClient();

  const [{ data: invoice }, { data: items }, { data: sriConfig }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id"),
    supabase.from("sri_configs").select("*").maybeSingle(),
    supabase.from("invoice_payments").select("*").eq("invoice_id", id),
  ]);

  if (!invoice) notFound();

  let existingCreditNote: any = null;
  try {
    const { data: cn } = await supabase
      .from("credit_notes")
      .select("id, credit_note_number, sri_status, sri_authorization_number, total, created_at, motivo, sri_error_messages")
      .eq("invoice_id", id)
      .maybeSingle();
    existingCreditNote = cn;
  } catch {
    // Si la tabla no está creada aún en la base de datos
  }

  // Obtener fotos registradas en invoice_photos (si existe la tabla)
  const { data: dbPhotos } = await supabase
    .from("invoice_photos")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  const allPhotos: InvoicePhoto[] = [...(dbPhotos || [])];

  if (payments && payments.length > 0) {
    payments.forEach((p: any) => {
      if (p.comprobante_url && !allPhotos.some(ph => ph.image_url === p.comprobante_url)) {
        allPhotos.push({
          id: `pay-${p.id}`,
          invoice_id: id,
          title: `Comprobante de Pago (${PAYMENT_METHOD_LABELS[p.payment_method] || p.payment_method || "Cobro"})`,
          image_url: p.comprobante_url,
          created_at: p.created_at || p.payment_date || invoice.created_at,
        });
      }
    });
  }

  if (invoice.image_url && !allPhotos.some(ph => ph.image_url === invoice.image_url)) {
    allPhotos.push({
      id: `inv-img-${invoice.id}`,
      invoice_id: id,
      title: "Imagen de Factura",
      image_url: invoice.image_url,
      created_at: invoice.created_at,
    });
  }

  if (invoice.comprobante_url && !allPhotos.some(ph => ph.image_url === invoice.comprobante_url)) {
    allPhotos.push({
      id: `inv-comp-${invoice.id}`,
      invoice_id: id,
      title: "Comprobante de Factura",
      image_url: invoice.comprobante_url,
      created_at: invoice.created_at,
    });
  }

  if (invoice.payment_reference && (invoice.payment_reference.startsWith("http://") || invoice.payment_reference.startsWith("https://"))) {
    if (!allPhotos.some(ph => ph.image_url === invoice.payment_reference)) {
      allPhotos.push({
        id: `inv-ref-${invoice.id}`,
        invoice_id: id,
        title: "Comprobante de Pago (Referencia)",
        image_url: invoice.payment_reference,
        created_at: invoice.created_at,
      });
    }
  }

  if (Array.isArray(invoice.images)) {
    invoice.images.forEach((img: any, idx: number) => {
      const url = typeof img === "string" ? img : img?.url;
      if (url && !allPhotos.some(ph => ph.image_url === url)) {
        allPhotos.push({
          id: `inv-images-${idx}`,
          invoice_id: id,
          title: typeof img === "object" && img?.title ? img.title : `Adjunto ${idx + 1}`,
          image_url: url,
          created_at: invoice.created_at,
        });
      }
    });
  }

  const issuedAt = new Date(invoice.created_at).toLocaleDateString("es-EC", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const ivaLabel = (code: string) =>
    code === "4" ? "15%" : code === "0" ? "0%" : code === "2" ? "12%" : code;

  const isInvoiceLocked = invoice.sri_status === "authorized" || invoice.sri_status === "cancelled" || invoice.sri_status === "submitted";
  const hasPhotos = allPhotos.length > 0;

  // Consultar asientos contables vinculados a la factura y/o nota de crédito
  let journalEntries: JournalEntryItem[] = [];
  try {
    const refIds = [id];
    if (existingCreditNote?.id) refIds.push(existingCreditNote.id);

    const { data: rawEntries } = await supabase
      .from("journal_entries")
      .select(`
        id,
        entry_number,
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
      .in("reference_type", ["invoice", "credit_note"])
      .in("reference_id", refIds)
      .order("created_at", { ascending: true });

    if (rawEntries && rawEntries.length > 0) {
      journalEntries = rawEntries as any[];
    }
  } catch (jErr) {
    console.warn("No se pudieron consultar asientos de journal_entries para factura:", jErr);
  }

  // Si no hay asiento registrado de venta en journal_entries, proyectar el devengo NIIF
  const hasSaleEntry = journalEntries.some(
    (e) =>
      e.reference_type === "invoice" &&
      e.journal_lines.some((l) => Number(l.credit) > 0 && l.account_code.startsWith("4."))
  );

  const tot = Number(invoice.total || 0);
  const subtotalTotal = Number(invoice.subtotal_0 || 0) + Number(invoice.subtotal_15 || 0);
  const ivaAmt = Number(invoice.iva_amount || 0);
  const invDate =
    invoice.issue_date ||
    (invoice.created_at ? invoice.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);

  // Resolver cuentas contables NIIF según origen (Clínica, Cursos, Coworking u Otros)
  const area = (invoice.billing_area || invoice.area || "").toLowerCase();
  let cxcCode = "1.1.02.01";
  let cxcName = "Cuentas por Cobrar Pacientes (Clínica)";
  let incCode = "4.1.01.01";
  let incName = "Servicios Odontológicos";

  if (area === "cursos") {
    cxcCode = "1.1.02.02";
    cxcName = "Cuentas por Cobrar Alumnos (Cursos)";
    incCode = "4.2.01.01";
    incName = "Servicios de Capacitación y Cursos";
  } else if (area === "coworking") {
    cxcCode = "1.1.02.03";
    cxcName = "Cuentas por Cobrar Inquilinos (Coworking)";
    incCode = "4.3.01.01";
    incName = "Alquiler de Espacios y Sillones Odontológicos";
  } else if (area === "otros") {
    cxcCode = "1.1.02.04";
    cxcName = "Anticipos a Proveedores y Otras Ctas. por Cobrar";
    incCode = "4.4.01.01";
    incName = "Otros Ingresos No Operacionales";
  }

  if (!hasSaleEntry) {
    const saleLines: JournalLineItem[] = [
      {
        account_code: cxcCode,
        account_name: cxcName,
        debit: tot,
        credit: 0,
        description: invoice.client_name,
      },
      {
        account_code: incCode,
        account_name: incName,
        debit: 0,
        credit: subtotalTotal > 0 ? subtotalTotal : tot,
      },
    ];

    if (ivaAmt > 0) {
      saleLines.push({
        account_code: "2.1.03.01",
        account_name: "IVA en Ventas por Pagar",
        debit: 0,
        credit: ivaAmt,
      });
    }

    journalEntries.unshift({
      id: "proj-invoice-sale",
      entry_date: invDate,
      description: `Factura de Venta (${cxcName}) — ${invoice.client_name}`,
      reference_type: "invoice",
      reference_id: invoice.id,
      journal_lines: saleLines,
    });
  }

  // Verificar si hay cobros/pagos registrados para mostrarlos en el asiento
  const hasPaymentEntry = journalEntries.some(
    (e) =>
      e.journal_lines.some(
        (l) => (l.account_code === "1.1.01.03" || l.account_code === "1.1.01.02") && Number(l.debit) > 0
      )
  );

  if (!hasPaymentEntry) {
    if (payments && payments.length > 0) {
      payments.forEach((p: any, idx: number) => {
        const pAmt = Number(p.amount || 0);
        const pDate = p.payment_date || p.created_at?.split("T")[0] || invDate;
        const isEfectivo = p.payment_method === "efectivo";
        journalEntries.push({
          id: `proj-pay-${p.id || idx}`,
          entry_date: pDate,
          description: `Cobro Factura ${invoice.invoice_number || ""} (${p.payment_method || "Cobro"})`,
          reference_type: "invoice",
          reference_id: invoice.id,
          journal_lines: [
            {
              account_code: isEfectivo ? "1.1.01.02" : "1.1.01.03",
              account_name: isEfectivo ? "Caja General" : "Bancos Cuentas Corrientes y Ahorros",
              debit: pAmt,
              credit: 0,
            },
            {
              account_code: cxcCode,
              account_name: cxcName,
              debit: 0,
              credit: pAmt,
              description: `Liquidación cobro factura ${invoice.client_name}`,
            },
          ],
        });
      });
    } else if (invoice.payment_status === "paid") {
      journalEntries.push({
        id: "proj-pay-full",
        entry_date: invDate,
        description: `Cobro Total Factura ${invoice.invoice_number || ""}`,
        reference_type: "invoice",
        reference_id: invoice.id,
        journal_lines: [
          {
            account_code: "1.1.01.03",
            account_name: "Bancos Cuentas Corrientes y Ahorros",
            debit: tot,
            credit: 0,
          },
          {
            account_code: cxcCode,
            account_name: cxcName,
            debit: 0,
            credit: tot,
            description: `Cobro total paciente ${invoice.client_name}`,
          },
        ],
      });
    }
  }

  // Verificar si hay Nota de Crédito asociada y reflejarla si no tiene asiento físico
  const hasCnEntry = journalEntries.some(
    (e) => e.reference_type === "credit_note" || e.description.toLowerCase().includes("crédito")
  );

  if (existingCreditNote && !hasCnEntry) {
    const cnTotal = Number(existingCreditNote.total || tot);
    const cnSubtotal = Math.max(0, cnTotal - (ivaAmt > 0 ? (cnTotal * 0.15) / 1.15 : 0));
    const cnIva = Math.round((cnTotal - cnSubtotal) * 100) / 100;
    const cnDate = existingCreditNote.created_at?.split("T")[0] || invDate;

    const cnLines: JournalLineItem[] = [
      {
        account_code: incCode,
        account_name: `${incName} (Reversión)`,
        debit: Math.round(cnSubtotal * 100) / 100,
        credit: 0,
      },
    ];
    if (cnIva > 0) {
      cnLines.push({
        account_code: "2.1.03.01",
        account_name: "IVA en Ventas por Pagar (Reversión)",
        debit: cnIva,
        credit: 0,
      });
    }
    cnLines.push({
      account_code: cxcCode,
      account_name: cxcName,
      debit: 0,
      credit: cnTotal,
      description: `Nota de Crédito ${existingCreditNote.credit_note_number || ""}`,
    });

    journalEntries.push({
      id: `proj-cn-${existingCreditNote.id}`,
      entry_date: cnDate,
      description: `Nota de Crédito ${existingCreditNote.credit_note_number || ""} — Reversión Factura ${invoice.invoice_number}`,
      reference_type: "credit_note",
      reference_id: existingCreditNote.id,
      journal_lines: cnLines,
    });
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/erp/facturacion"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-ink-900">
              Factura {invoice.invoice_number || "Borrador"}
            </h1>
            <StatusBadge status={invoice.sri_status || "draft"} env={invoice.sri_environment} />
            {invoice.payment_status && invoice.payment_status !== "cancelled" && invoice.sri_status !== "cancelled" && (
              <PaymentBadge status={invoice.payment_status} />
            )}
          </div>
          <p className="text-xs text-ink-500 mt-0.5">{issuedAt}</p>
        </div>
        {/* Acciones de Factura */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Ver Asiento Contable */}
          <AsientoContableModal entries={journalEntries} />

          {/* Botón Registrar Cobro (Top) */}
          {(invoice.payment_status === "pending" || invoice.payment_status === "partial") && (
            <Link href={`/erp/cuentas-por-cobrar?pay=${invoice.id}`}
              className="text-xs py-2 px-3.5 rounded-xl shadow-2xs flex items-center gap-1.5 font-bold transition-transform bg-amber-400 text-amber-950 hover:bg-amber-300 border border-amber-500 hover:scale-[1.02] active:scale-[0.98]">
              <Clock size={15} /> Registrar Cobro
            </Link>
          )}

          <a
            href={`/api/factura/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs py-2 px-3.5 shadow-2xs flex items-center gap-1.5 font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Printer size={15} /> Reimprimir Factura
          </a>

          {canEdit && (invoice.sri_status === "authorized" || existingCreditNote) && (
            <EmitirNotaCreditoModal
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              clientName={invoice.client_name}
              clientDocument={invoice.client_document}
              issueDate={invoice.issue_date || (invoice.created_at ? invoice.created_at.split("T")[0] : "")}
              total={Number(invoice.total || 0)}
              subtotal15={Number(invoice.subtotal_15 || 0)}
              subtotal0={Number(invoice.subtotal_0 || 0)}
              ivaAmount={Number(invoice.iva_amount || 0)}
              items={items || []}
              existingCreditNote={existingCreditNote || null}
            />
          )}

          {invoice.sri_status !== "cancelled" && !existingCreditNote && canEdit && (
            <AnularFacturaButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              sriStatus={invoice.sri_status || "draft"}
              clientDocument={invoice.client_document}
              issueDate={invoice.issue_date || (invoice.created_at ? invoice.created_at.split("T")[0] : "")}
              sriAccessKey={invoice.sri_authorization_number || invoice.sri_access_key}
            />
          )}
          {/* Botón reintento para facturas en estado submitted */}
          {invoice.sri_status === "submitted" && (
            <ReintentoSriButton invoiceId={invoice.id} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Banner Informativo si existe Nota de Crédito */}
        {existingCreditNote && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-950 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shrink-0 font-bold">
                NC
              </div>
              <div>
                <p className="text-xs font-bold">
                  Nota de Crédito emitida: {existingCreditNote.credit_note_number}
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Estado SRI: <strong className="uppercase">{existingCreditNote.sri_status}</strong> · Motivo: {existingCreditNote.motivo || "Anulación de comprobante"}
                </p>
                {existingCreditNote.sri_status === "rejected" && existingCreditNote.sri_error_messages && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 bg-red-100/60 p-1.5 rounded-lg border border-red-200">
                    Motivo rechazo SRI: {
                      Array.isArray(existingCreditNote.sri_error_messages)
                        ? existingCreditNote.sri_error_messages.map((m: any) => m.mensaje || JSON.stringify(m)).join(" · ")
                        : String(existingCreditNote.sri_error_messages)
                    }
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {existingCreditNote.sri_status !== "authorized" && (
                <SyncNotaCreditoButton
                  creditNoteId={existingCreditNote.id}
                  currentStatus={existingCreditNote.sri_status}
                  creditNoteNumber={existingCreditNote.credit_note_number}
                />
              )}
              <a
                href={`/api/nota-credito/${existingCreditNote.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-rose-800 border border-rose-300 hover:bg-rose-100 px-3 py-1.5 rounded-xl transition shadow-2xs"
              >
                <Printer size={13} /> Ver RIDE NC
              </a>
            </div>
          </div>
        )}
        {/* ── SRI Info & Emisor (Grid 2 columnas) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* Información SRI */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 h-full">
            <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2 mb-3">
              <Hash size={14} className="text-lilac-500" /> Información SRI
            </h2>
            <div className="space-y-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-ink-500 uppercase tracking-wide font-bold">
                  Clave de Acceso / N° de Autorización (SRI)
                </span>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-lilac-50 border border-lilac-100 rounded-lg px-3 py-1.5 break-all flex-1 font-bold text-ink-900 select-all">
                    {invoice.sri_authorization_number || invoice.sri_access_key || "No disponible"}
                  </code>
                  {(invoice.sri_authorization_number || invoice.sri_access_key) && (
                    <CopyButton text={invoice.sri_authorization_number || invoice.sri_access_key} label="Copiar Clave de Acceso" />
                  )}
                </div>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  Esta clave de 49 dígitos es el identificador único con el que se consulta o anula la factura en el SRI.
                </p>
              </div>

              {invoice.sri_access_key && invoice.sri_authorization_number && invoice.sri_access_key !== invoice.sri_authorization_number && (
                <div>
                  <span className="text-[11px] text-ink-400 uppercase tracking-wide">Clave de Acceso Secundaria</span>
                  <p className="text-xs font-mono text-ink-800 break-all">{invoice.sri_access_key}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-ink-400 uppercase tracking-wide">Ambiente</span>
                  <p className="text-sm font-medium text-ink-800">
                    {invoice.sri_environment === "2" ? "🟢 Producción" : "🔵 Pruebas"}
                  </p>
                </div>
                {invoice.sri_authorization_date && (
                  <div>
                    <span className="text-[11px] text-ink-400 uppercase tracking-wide">Fecha Autorización</span>
                    <p className="text-sm text-ink-800">
                      {new Date(invoice.sri_authorization_date).toLocaleDateString("es-EC")}
                    </p>
                  </div>
                )}
              </div>

              {/* Mensajes y registros SRI / Anulación */}
              {invoice.sri_error_messages && (
                <div className="space-y-2 mt-2">
                  {(invoice.sri_error_messages as any).annulment && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Trash2 size={14} className="text-red-500" /> Registro de Anulación Local
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                          Anulada en Sistema
                        </span>
                      </div>

                      <div className="text-slate-600 space-y-0.5 text-[11px]">
                        <p><b>Anulado por:</b> {(invoice.sri_error_messages as any).annulment.annulled_by}</p>
                        <p><b>Fecha de anulación:</b> {new Date((invoice.sri_error_messages as any).annulment.annulled_at).toLocaleString("es-EC")}</p>
                        <p><b>Estado original:</b> {(invoice.sri_error_messages as any).annulment.original_status} (pago: {(invoice.sri_error_messages as any).annulment.original_payment_status})</p>
                      </div>

                      <div className="pt-1 flex items-center justify-end">
                        <a
                          href="https://srienlinea.sri.gob.ec/sri-en-linea/inicio/NAT"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 hover:underline"
                        >
                          <span>Ir a anulación en SRI en Línea</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  )}

                  {Object.keys(invoice.sri_error_messages as object).filter((k) => k !== "annulment").length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1">Observaciones SRI</p>
                      <pre className="text-xs text-red-600 whitespace-pre-wrap">
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(invoice.sri_error_messages as object).filter(([k]) => k !== "annulment")
                          ),
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Datos del Emisor */}
          {sriConfig && (
            <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 h-full">
              <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2 mb-3">
                <Building2 size={14} className="text-lilac-500" /> Datos del Emisor
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-ink-400 uppercase tracking-wide">Razón Social</span>
                  <p className="text-sm font-medium text-ink-800">{sriConfig.razon_social || "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] text-ink-400 uppercase tracking-wide">RUC</span>
                  <p className="text-sm font-mono text-ink-800">{sriConfig.ruc || "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] text-ink-400 uppercase tracking-wide">Establecimiento / P. Emisión</span>
                  <p className="text-sm font-mono text-ink-800">{sriConfig.establecimiento || "001"}-{sriConfig.punto_emision || "001"}</p>
                </div>
                {sriConfig.nombre_comercial && (
                  <div>
                    <span className="text-[11px] text-ink-400 uppercase tracking-wide">Nombre Comercial</span>
                    <p className="text-sm text-ink-800">{sriConfig.nombre_comercial}</p>
                  </div>
                )}
                {sriConfig.direccion_matriz && (
                  <div className="col-span-2">
                    <span className="text-[11px] text-ink-400 uppercase tracking-wide">Dirección Matriz</span>
                    <p className="text-sm text-ink-800">{sriConfig.direccion_matriz}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Cliente, Forma de Pago & Comprobantes ── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2 border-b border-lilac-50 pb-2">
            <User size={14} className="text-lilac-500" /> Datos del Cliente & Forma de Pago
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide font-semibold">Nombre / Razón Social</span>
              <p className="text-sm font-medium text-ink-800">{invoice.client_name}</p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide font-semibold">{getDocumentLabel(invoice.client_document)}</span>
              <p className="text-sm font-mono text-ink-800">{invoice.client_document}</p>
            </div>
            {invoice.client_email && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide font-semibold">Email</span>
                <p className="text-sm text-ink-800">{invoice.client_email}</p>
              </div>
            )}
            {invoice.client_address && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide font-semibold">Dirección</span>
                <p className="text-sm text-ink-800">{invoice.client_address}</p>
              </div>
            )}
          </div>

          {/* Fila Integrada: Forma de Pago Registrada + Botón/Mini-Imagen de Comprobante */}
          {invoice.payment_method && (
            <div className="pt-3 border-t border-lilac-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-lilac-50/20 p-3 rounded-xl border border-lilac-100">
              <div>
                <span className="text-[10px] text-ink-400 uppercase tracking-wide font-extrabold block">Forma de Pago Registrada</span>
                <p className="text-sm font-bold text-ink-950 flex items-center gap-1.5 flex-wrap mt-0.5">
                  <CreditCard size={14} className="text-lilac-700" />
                  <span>{PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}</span>
                  {invoice.card_type && <span className="text-lilac-800 font-extrabold text-xs">({invoice.card_type})</span>}
                  {invoice.card_voucher && <span className="text-ink-700 font-mono text-xs font-bold bg-white border border-lilac-200 px-2 py-0.5 rounded-md">Voucher: {invoice.card_voucher}</span>}
                  {invoice.card_lote && <span className="text-ink-700 font-mono text-xs font-bold bg-white border border-lilac-200 px-2 py-0.5 rounded-md">Lote: {invoice.card_lote}</span>}
                  {invoice.payment_reference && !invoice.card_voucher && !invoice.payment_reference.startsWith("http") && <span className="text-ink-700 font-mono text-xs font-bold bg-white border border-lilac-200 px-2 py-0.5 rounded-md">Ref: {invoice.payment_reference}</span>}
                </p>
              </div>

              {/* Botón o Mini Imagen de Comprobante directo en la misma línea de Forma de Pago */}
              <div className="shrink-0">
                <InvoicePhotosSection
                  invoiceId={invoice.id}
                  initialPhotos={allPhotos}
                  canModify={canEdit}
                  isLocked={isInvoiceLocked}
                  variant="inline"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Ítems ──────────────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-lilac-50 flex items-center gap-2">
            <FileText size={14} className="text-lilac-500" />
            <h2 className="text-sm font-semibold text-ink-700">Detalle de Ítems</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lilac-50/50 text-ink-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Descripción</th>
                  <th className="px-4 py-2.5 text-center">Cant.</th>
                  <th className="px-4 py-2.5 text-right">P. Unit.</th>
                  <th className="px-4 py-2.5 text-right">Desc.</th>
                  <th className="px-4 py-2.5 text-center">IVA</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {(items || []).map((item) => (
                  <tr key={item.id} className="hover:bg-lilac-50/20">
                    <td className="px-4 py-2.5 text-ink-800">{item.description}</td>
                    <td className="px-4 py-2.5 text-center text-ink-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-ink-600">${Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600 font-medium">
                      {Number(item.discount || 0) > 0 ? `-$${Number(item.discount).toFixed(2)}` : "$0.00"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-lilac-50 text-lilac-700 font-medium">
                        {ivaLabel(item.iva_code)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink-900">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="border-t border-lilac-100 px-4 py-3 flex flex-col items-end gap-1 bg-lilac-50/20">
            {Number(invoice.subtotal_0) > 0 && (
              <div className="flex gap-8 text-sm text-ink-600">
                <span>Subtotal 0%</span>
                <span className="font-medium w-24 text-right">${Number(invoice.subtotal_0).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.subtotal_15) > 0 && (
              <div className="flex gap-8 text-sm text-ink-600">
                <span>Subtotal 15%</span>
                <span className="font-medium w-24 text-right">${Number(invoice.subtotal_15).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.total_discount) > 0 && (
              <div className="flex gap-8 text-sm text-ink-600">
                <span>Descuento</span>
                <span className="font-medium w-24 text-right text-red-600">-${Number(invoice.total_discount).toFixed(2)}</span>
              </div>
            )}
            {Number(invoice.iva_amount) > 0 && (
              <div className="flex gap-8 text-sm text-ink-600">
                <span>IVA</span>
                <span className="font-medium w-24 text-right">${Number(invoice.iva_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex gap-8 text-base font-bold text-ink-900 border-t border-lilac-200 pt-2 mt-1">
              <span>TOTAL</span>
              <span className="w-24 text-right">${Number(invoice.total).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
