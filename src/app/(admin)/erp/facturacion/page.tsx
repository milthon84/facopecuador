import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Printer,
  Receipt,
  Calendar,
} from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function BillingDashboard({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ tab?: string; month?: string }>;
}) {
  await assertPermission("/erp/facturacion");
  const canEdit = await hasWritePermission("/erp/facturacion");
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const activeTab = searchParams.tab || "facturas";

  const supabase = createAdminClient();

  // 1. Selector de Meses (Últimos 12 meses + opción 'Todos')
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeMonth = searchParams.month ?? currentMonthStr;

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Fechas de filtro si no es 'all'
  let startDate = "";
  let endDate = "";
  if (activeMonth !== "all") {
    const [year, monthNum] = activeMonth.split("-").map(Number);
    startDate = new Date(year, monthNum - 1, 1).toISOString().split("T")[0];
    endDate = new Date(year, monthNum, 0).toISOString().split("T")[0];
  }

  // 2. Consultas a Supabase
  let invoiceQuery = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  let cnQuery = supabase
    .from("credit_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeMonth !== "all") {
    invoiceQuery = invoiceQuery.gte("issue_date", startDate).lte("issue_date", endDate);
    cnQuery = cnQuery.gte("issue_date", startDate).lte("issue_date", endDate);
  } else {
    invoiceQuery = invoiceQuery.limit(100);
    cnQuery = cnQuery.limit(100);
  }

  const [
    { data: invoices },
    { data: cnData },
    { data: allCreditNotes },
  ] = await Promise.all([
    invoiceQuery,
    cnQuery.then((res) => res).catch(() => ({ data: [] })),
    supabase
      .from("credit_notes")
      .select("id, invoice_id, credit_note_number, sri_status, total")
      .then((res) => res)
      .catch(() => ({ data: [] })),
  ]);

  const items = invoices || [];
  const creditNotes = cnData || [];

  // Mapa para vincular rápidamente Facturas con sus Notas de Crédito
  const invoiceToCreditNoteMap = new Map<string, any>();
  (allCreditNotes || []).forEach((cn: any) => {
    if (cn.invoice_id) {
      invoiceToCreditNoteMap.set(cn.invoice_id, cn);
    }
  });

  // 3. Cálculos y métricas del período
  const totalFacturado = items.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const autorizadas = items.filter((inv) => inv.sri_status === "authorized");
  const totalAutorizado = autorizadas.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  // Notas de crédito vinculadas en este mes
  const facturasConNc = items.filter((inv) => {
    const cn = invoiceToCreditNoteMap.get(inv.id);
    const hasMsgCn = Boolean(inv.sri_error_messages?.credit_note);
    return Boolean(cn || hasMsgCn);
  });

  const totalNc = creditNotes.reduce((sum, cn) => sum + Number(cn.total || 0), 0);

  const getStatusStyle = (status: string, env?: string) => {
    switch (status) {
      case "authorized":
        const suffix = env === "2" ? "Producción" : "Pruebas";
        return {
          bg: "bg-green-100 text-green-700 border-green-200",
          icon: <CheckCircle2 size={13} />,
          text: `Autorizado (${suffix})`,
        };
      case "rejected":
        return {
          bg: "bg-red-100 text-red-700 border-red-200",
          icon: <XCircle size={13} />,
          text: "Rechazado",
        };
      case "error":
        return {
          bg: "bg-red-100 text-red-700 border-red-200",
          icon: <AlertCircle size={13} />,
          text: "Error",
        };
      case "draft":
        return {
          bg: "bg-amber-100 text-amber-700 border-amber-200",
          icon: <Clock size={13} />,
          text: "Borrador",
        };
      case "cancelled":
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <XCircle size={13} />,
          text: "Anulado",
        };
      default:
        return {
          bg: "bg-lilac-100 text-lilac-700 border-lilac-200",
          icon: <Clock size={13} />,
          text: status,
        };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            <FileText className="text-lilac-600" size={22} />
            Facturación Electrónica SRI
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            Emite y gestiona facturas y notas de crédito electrónicas autorizadas por el SRI.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/erp/facturacion/nueva"
              className="btn-primary flex items-center gap-1.5 text-xs bg-lilac-600 hover:bg-lilac-700 text-white px-3.5 py-2 rounded-xl transition font-bold shadow-sm"
            >
              <Plus size={15} />
              <span>Emitir Factura</span>
            </Link>
          </div>
        )}
      </div>

      {/* Selector de Meses Horizontal */}
      <div className="flex items-center gap-2">
        <Calendar size={15} className="text-ink-400 shrink-0" />
        <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
          <Link
            href={`/erp/facturacion?month=all&tab=${activeTab}`}
            className={`shrink-0 px-3 py-1 rounded-xl transition font-semibold flex items-center justify-center ${
              activeMonth === "all"
                ? "bg-lilac-600 text-white shadow-xs"
                : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}
          >
            Todos
          </Link>

          {months.map((m) => {
            const isSelected = m === activeMonth;
            const [y, mo] = m.split("-").map(Number);
            const label = new Date(y, mo - 1, 1).toLocaleDateString("es-EC", {
              month: "short",
              year: "2-digit",
            });

            return (
              <Link
                key={m}
                href={`/erp/facturacion?month=${m}&tab=${activeTab}`}
                className={`shrink-0 px-2.5 py-1 rounded-xl transition font-semibold flex items-center justify-center capitalize ${
                  isSelected
                    ? "bg-lilac-600 text-white shadow-xs"
                    : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tarjetas de Métricas Financieras del Período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border border-lilac-100 shadow-xs">
          <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
            Total Facturado
          </div>
          <div className="text-lg font-black text-ink-900 mt-0.5">
            ${totalFacturado.toFixed(2)}
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5">
            {items.length} {items.length === 1 ? "factura" : "facturas"}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-emerald-100 shadow-xs">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={11} /> Autorizadas SRI
          </div>
          <div className="text-lg font-black text-emerald-700 mt-0.5">
            ${totalAutorizado.toFixed(2)}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">
            {autorizadas.length} comprobantes
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-rose-100 shadow-xs">
          <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <Receipt size={11} /> Con Nota de Crédito
          </div>
          <div className="text-lg font-black text-rose-700 mt-0.5">
            ${totalNc.toFixed(2)}
          </div>
          <div className="text-[10px] text-rose-600 mt-0.5">
            {facturasConNc.length} con NC emitida
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-indigo-100 shadow-xs">
          <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
            Total Neto Real
          </div>
          <div className="text-lg font-black text-indigo-900 mt-0.5">
            ${Math.max(0, totalAutorizado - totalNc).toFixed(2)}
          </div>
          <div className="text-[10px] text-indigo-600 mt-0.5">Facturado menos NC</div>
        </div>
      </div>

      {/* Selector de Pestañas: Facturas vs Notas de Crédito */}
      <div className="flex items-center gap-2 border-b border-lilac-100 pb-2">
        <Link
          href={`/erp/facturacion?tab=facturas${activeMonth ? `&month=${activeMonth}` : ""}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "facturas"
              ? "bg-lilac-600 text-white shadow-sm"
              : "bg-white text-ink-600 hover:bg-lilac-50 border border-lilac-200"
          }`}
        >
          <FileText size={15} />
          <span>Facturas ({items.length})</span>
        </Link>

        <Link
          href={`/erp/facturacion?tab=notas-credito${activeMonth ? `&month=${activeMonth}` : ""}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "notas-credito"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-white text-ink-600 hover:bg-rose-50 border border-rose-200"
          }`}
        >
          <Receipt size={15} />
          <span>Notas de Crédito ({creditNotes.length})</span>
        </Link>
      </div>

      {/* TABLA DE FACTURAS */}
      {activeTab === "facturas" && (
        <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-lilac-50/50 text-ink-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Factura N°</th>
                  <th className="px-5 py-3.5">Cliente / RUC</th>
                  <th className="px-5 py-3.5">Fecha Emisión</th>
                  <th className="px-5 py-3.5 text-right">Total</th>
                  <th className="px-5 py-3.5 text-center">Estado SRI</th>
                  <th className="px-5 py-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileText size={36} className="text-lilac-200" />
                        <p className="text-sm">No se encontraron facturas para este período.</p>
                        {canEdit && (
                          <Link
                            href="/erp/facturacion/nueva"
                            className="text-lilac-600 hover:underline text-xs font-semibold"
                          >
                            Emitir una factura
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((inv) => {
                    const style = getStatusStyle(inv.sri_status, inv.sri_environment);
                    const dateStr = new Date(inv.created_at || inv.issue_date).toLocaleDateString("es-EC");

                    // Detectar si la factura tiene Nota de Crédito asociada
                    const linkedCn =
                      invoiceToCreditNoteMap.get(inv.id) ||
                      (inv.sri_error_messages?.credit_note
                        ? {
                            id: inv.sri_error_messages.credit_note.credit_note_id,
                            credit_note_number:
                              inv.sri_error_messages.credit_note.credit_note_number,
                            sri_status: "authorized",
                          }
                        : null);

                    return (
                      <tr key={inv.id} className="hover:bg-lilac-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-ink-900 font-mono">
                                {inv.invoice_number || "Borrador"}
                              </span>

                              {/* INDICADOR VISUAL NC */}
                              {linkedCn && (
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md font-bold shadow-2xs"
                                  title={`Factura modificada con Nota de Crédito ${linkedCn.credit_note_number} (${linkedCn.sri_status})`}
                                >
                                  <Receipt size={11} className="text-rose-600" />
                                  <span>NC {linkedCn.credit_note_number ? `(${linkedCn.credit_note_number})` : ""}</span>
                                </span>
                              )}
                            </div>
                            <div
                              className="text-[10px] text-ink-400 font-mono mt-0.5 truncate max-w-[150px]"
                              title={inv.sri_access_key}
                            >
                              {inv.sri_access_key}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div className="font-medium text-ink-900">{inv.client_name}</div>
                            <div className="text-xs text-ink-500 mt-0.5 font-mono">{inv.client_document}</div>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-ink-600 text-xs">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            {dateStr}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div
                              className={`font-black ${
                                linkedCn ? "line-through text-ink-400" : "text-ink-900"
                              }`}
                            >
                              ${Number(inv.total).toFixed(2)}
                            </div>
                            {linkedCn && (
                              <div className="text-[10px] text-rose-600 font-bold">
                                Anulado por NC
                              </div>
                            )}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg}`}
                            >
                              {style.icon}
                              {style.text}
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <a
                              href={`/api/factura/${inv.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 hover:bg-lilac-100 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                              title="Reimprimir RIDE de la Factura"
                            >
                              <Printer size={12} />
                              <span>RIDE</span>
                            </a>

                            {/* Botón directo RIDE NC si tiene nota de crédito */}
                            {linkedCn?.id && (
                              <a
                                href={`/api/nota-credito/${linkedCn.id}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                                title={`Ver RIDE de la Nota de Crédito ${linkedCn.credit_note_number}`}
                              >
                                <Receipt size={12} />
                                <span>RIDE NC</span>
                              </a>
                            )}

                            <Link
                              href={`/erp/facturacion/${inv.id}`}
                              className="inline-flex items-center text-xs font-semibold text-ink-600 bg-white border border-lilac-200 hover:bg-lilac-50 px-2 py-1 rounded-lg transition-colors shadow-2xs"
                            >
                              Ver
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA DE NOTAS DE CRÉDITO */}
      {activeTab === "notas-credito" && (
        <div className="bg-white border border-rose-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-rose-50/50 text-ink-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Nota Crédito N°</th>
                  <th className="px-5 py-3.5">Factura Modificada</th>
                  <th className="px-5 py-3.5">Cliente / RUC</th>
                  <th className="px-5 py-3.5">Motivo</th>
                  <th className="px-5 py-3.5 text-right">Total Modificado</th>
                  <th className="px-5 py-3.5 text-center">Estado SRI</th>
                  <th className="px-5 py-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-500">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt size={36} className="text-rose-200" />
                        <p className="text-sm">No se encontraron notas de crédito en este período.</p>
                        <p className="text-xs text-ink-400">
                          Puedes emitir una Nota de Crédito entrando al detalle de cualquier factura autorizada.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  creditNotes.map((cn: any) => {
                    const style = getStatusStyle(cn.sri_status, cn.sri_environment);
                    const dateStr = new Date(cn.created_at || cn.issue_date).toLocaleDateString("es-EC");

                    return (
                      <tr key={cn.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-rose-950 font-mono">
                            {cn.credit_note_number || "Borrador"}
                          </div>
                          <div
                            className="text-[10px] text-ink-400 font-mono mt-0.5 truncate max-w-[140px]"
                            title={cn.sri_access_key}
                          >
                            {cn.sri_access_key}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {cn.invoice_id ? (
                            <Link
                              href={`/erp/facturacion/${cn.invoice_id}`}
                              className="font-semibold text-lilac-700 hover:underline font-mono"
                            >
                              Fac. {cn.num_doc_modificado}
                            </Link>
                          ) : (
                            <span className="font-mono text-ink-800">Fac. {cn.num_doc_modificado}</span>
                          )}
                          <div className="text-[10px] text-ink-400">{dateStr}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-ink-900">{cn.client_name}</div>
                          <div className="text-xs text-ink-500 mt-0.5 font-mono">{cn.client_document}</div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-ink-600 max-w-[180px] truncate" title={cn.motivo}>
                          {cn.motivo}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <div className="font-black text-rose-700">${Number(cn.total).toFixed(2)}</div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg}`}
                          >
                            {style.icon}
                            {style.text}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <a
                            href={`/api/nota-credito/${cn.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                            title="Ver / Descargar RIDE PDF de la Nota de Crédito"
                          >
                            <Printer size={13} />
                            <span>RIDE PDF</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
