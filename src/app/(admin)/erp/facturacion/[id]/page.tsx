import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertCircle, Clock,
  User, FileText, Hash, CreditCard, RefreshCw, Printer, Trash2,
} from "lucide-react";
import CopyButton from "@/components/CopyButton";
import ReintentoSriButton from "@/components/ReintentoSriButton";
import AnularFacturaButton from "@/components/AnularFacturaButton";
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

  const [{ data: invoice }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id"),
  ]);

  if (!invoice) notFound();

  const issuedAt = new Date(invoice.created_at).toLocaleDateString("es-EC", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const ivaLabel = (code: string) =>
    code === "4" ? "15%" : code === "0" ? "0%" : code === "2" ? "12%" : code;

  return (
    <div className="max-w-3xl mx-auto">
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
            {invoice.payment_status && <PaymentBadge status={invoice.payment_status} />}
          </div>
          <p className="text-xs text-ink-500 mt-0.5">{issuedAt}</p>
        </div>
        {/* Acciones de Factura */}
        <div className="flex items-center gap-2">
          <a
            href={`/api/factura/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-xs py-2 px-3.5 shadow-2xs flex items-center gap-1.5 font-bold hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            <Printer size={15} /> Reimprimir Factura
          </a>
          {invoice.sri_status !== "cancelled" && canEdit && (
            <AnularFacturaButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              sriStatus={invoice.sri_status || "draft"}
              clientDocument={invoice.client_document}
              issueDate={invoice.issue_date}
              sriAccessKey={invoice.sri_access_key}
            />
          )}
          {/* Botón reintento para facturas en estado submitted */}
          {invoice.sri_status === "submitted" && (
            <ReintentoSriButton invoiceId={invoice.id} />
          )}
        </div>
      </div>

      <div className="space-y-4">

        {/* ── SRI Info ───────────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2 mb-3">
            <Hash size={14} className="text-lilac-500" /> Información SRI
          </h2>
          <div className="space-y-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Clave de Acceso (49 dígitos)</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-lilac-50 border border-lilac-100 rounded-lg px-3 py-1.5 break-all flex-1">
                  {invoice.sri_access_key}
                </code>
                <CopyButton text={invoice.sri_access_key} label="Copiar clave de acceso" />
              </div>
            </div>

            {invoice.sri_authorization_number && invoice.sri_authorization_number !== invoice.sri_access_key && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">N° Autorización</span>
                <p className="text-sm font-mono text-ink-800">{invoice.sri_authorization_number}</p>
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
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Trash2 size={13} className="text-red-500" /> Registro de Anulación Local
                    </p>
                    <div className="text-slate-600 space-y-0.5 pt-0.5 text-[11px]">
                      <p><b>Anulado por:</b> {(invoice.sri_error_messages as any).annulment.annulled_by}</p>
                      <p><b>Fecha de anulación:</b> {new Date((invoice.sri_error_messages as any).annulment.annulled_at).toLocaleString("es-EC")}</p>
                      <p><b>Estado original:</b> {(invoice.sri_error_messages as any).annulment.original_status} (pago: {(invoice.sri_error_messages as any).annulment.original_payment_status})</p>
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

        {/* ── Cliente ────────────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-ink-700 flex items-center gap-2 mb-3">
            <User size={14} className="text-lilac-500" /> Datos del Cliente
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">Nombre / Razón Social</span>
              <p className="text-sm font-medium text-ink-800">{invoice.client_name}</p>
            </div>
            <div>
              <span className="text-[11px] text-ink-400 uppercase tracking-wide">{getDocumentLabel(invoice.client_document)}</span>
              <p className="text-sm font-mono text-ink-800">{invoice.client_document}</p>
            </div>
            {invoice.client_email && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">Email</span>
                <p className="text-sm text-ink-800">{invoice.client_email}</p>
              </div>
            )}
            {invoice.client_address && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">Dirección</span>
                <p className="text-sm text-ink-800">{invoice.client_address}</p>
              </div>
            )}
            {invoice.payment_method && (
              <div>
                <span className="text-[11px] text-ink-400 uppercase tracking-wide">Forma de pago</span>
                <p className="text-sm text-ink-800 flex items-center gap-1.5 flex-wrap">
                  <CreditCard size={13} className="text-ink-400" />
                  {PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}
                  {invoice.card_type && <span className="text-lilac-700 font-semibold text-xs">({invoice.card_type})</span>}
                  {invoice.card_voucher && <span className="text-ink-500 font-mono text-xs">· Voucher: {invoice.card_voucher}</span>}
                  {invoice.card_lote && <span className="text-ink-500 font-mono text-xs">· Lote: {invoice.card_lote}</span>}
                  {invoice.payment_reference && !invoice.card_voucher && <span className="text-ink-400 font-mono text-xs">· Ref: {invoice.payment_reference}</span>}
                </p>
              </div>
            )}
            {invoice.payment_status === "pending" && (
              <div className="col-span-2">
                <Link href={`/erp/cuentas-por-cobrar?pay=${invoice.id}`}
                  className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 px-3 py-1 rounded-lg transition-colors font-medium">
                  <Clock size={12} /> Registrar cobro →
                </Link>
              </div>
            )}
          </div>
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
