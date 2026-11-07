import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileText, Plus, CheckCircle2, XCircle, AlertCircle, Clock, Printer, Receipt } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function BillingDashboard({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  await assertPermission("/erp/facturacion");
  const canEdit = await hasWritePermission("/erp/facturacion");
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const activeTab = searchParams.tab || "facturas";

  const supabase = createAdminClient();

  const [{ data: invoices }, { data: cnData }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("credit_notes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)
      .then((res) => res)
      .catch(() => ({ data: [] })),
  ]);

  const items = invoices || [];
  const creditNotes = cnData || [];

  const getStatusStyle = (status: string, env?: string) => {
    switch (status) {
      case "authorized":
        const suffix = env === "2" ? "Producción" : "Pruebas";
        return {
          bg: "bg-green-100 text-green-700",
          icon: <CheckCircle2 size={14} />,
          text: `Autorizado (${suffix})`,
        };
      case "rejected":
        return { bg: "bg-red-100 text-red-700", icon: <XCircle size={14} />, text: "Rechazado" };
      case "error":
        return { bg: "bg-red-100 text-red-700", icon: <AlertCircle size={14} />, text: "Error" };
      case "draft":
        return { bg: "bg-amber-100 text-amber-700", icon: <Clock size={14} />, text: "Borrador" };
      case "cancelled":
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-200",
          icon: <XCircle size={14} />,
          text: "Anulado",
        };
      default:
        return { bg: "bg-lilac-100 text-lilac-700", icon: <Clock size={14} />, text: status };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <FileText className="text-lilac-600" />
            Facturación Electrónica SRI
          </h1>
          <p className="text-sm text-ink-600">
            Emite y gestiona facturas y notas de crédito electrónicas autorizadas por el SRI.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/erp/facturacion/nueva"
              className="btn-primary flex items-center gap-1.5 text-xs bg-lilac-600 hover:bg-lilac-700 text-white px-3.5 py-2 rounded-xl transition-colors font-bold shadow-md shadow-lilac-200"
            >
              <Plus size={15} />
              <span>Emitir Factura</span>
            </Link>
          </div>
        )}
      </div>

      {/* Selector de Pestañas: Facturas vs Notas de Crédito */}
      <div className="flex items-center gap-2 border-b border-lilac-100 pb-2">
        <Link
          href="/erp/facturacion?tab=facturas"
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
          href="/erp/facturacion?tab=notas-credito"
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
                  <th className="px-5 py-4">Factura N°</th>
                  <th className="px-5 py-4">Cliente / RUC</th>
                  <th className="px-5 py-4">Fecha Emisión</th>
                  <th className="px-5 py-4 text-right">Total</th>
                  <th className="px-5 py-4 text-center">Estado SRI</th>
                  <th className="px-5 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-ink-500">
                      <div className="flex flex-col items-center gap-3">
                        <FileText size={40} className="text-lilac-200" />
                        <p>No se han emitido facturas aún.</p>
                        {canEdit && (
                          <Link href="/erp/facturacion/nueva" className="text-lilac-600 hover:underline font-medium">
                            Emitir la primera factura
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((inv) => {
                    const style = getStatusStyle(inv.sri_status, inv.sri_environment);
                    const dateStr = new Date(inv.created_at).toLocaleDateString("es-EC");

                    return (
                      <tr key={inv.id} className="hover:bg-lilac-50/30 transition-colors">
                        <td className="px-5 py-4">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div className="font-bold text-ink-900">{inv.invoice_number || "Borrador"}</div>
                            <div
                              className="text-[10px] text-ink-500 font-mono mt-0.5 truncate max-w-[150px]"
                              title={inv.sri_access_key}
                            >
                              {inv.sri_access_key}
                            </div>
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div className="font-medium text-ink-900">{inv.client_name}</div>
                            <div className="text-xs text-ink-500 mt-0.5">{inv.client_document}</div>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-ink-600">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            {dateStr}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <div className="font-bold text-ink-900">${Number(inv.total).toFixed(2)}</div>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <Link href={`/erp/facturacion/${inv.id}`} className="block">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg}`}
                            >
                              {style.icon}
                              {style.text}
                            </span>
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={`/api/factura/${inv.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 hover:bg-lilac-100 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
                              title="Reimprimir RIDE de la Factura"
                            >
                              <Printer size={13} />
                              <span>RIDE</span>
                            </a>
                            <Link
                              href={`/erp/facturacion/${inv.id}`}
                              className="inline-flex items-center text-xs font-semibold text-ink-600 bg-white border border-lilac-200 hover:bg-lilac-50 px-2.5 py-1 rounded-lg transition-colors shadow-2xs"
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
                  <th className="px-5 py-4">Nota Crédito N°</th>
                  <th className="px-5 py-4">Factura Modificada</th>
                  <th className="px-5 py-4">Cliente / RUC</th>
                  <th className="px-5 py-4">Motivo</th>
                  <th className="px-5 py-4 text-right">Total Modificado</th>
                  <th className="px-5 py-4 text-center">Estado SRI</th>
                  <th className="px-5 py-4 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {creditNotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-ink-500">
                      <div className="flex flex-col items-center gap-3">
                        <Receipt size={40} className="text-rose-200" />
                        <p>No se han emitido notas de crédito aún.</p>
                        <p className="text-xs text-ink-400">
                          Puedes emitir una Nota de Crédito ingresando al detalle de cualquier factura autorizada.
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
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4">
                          <div className="font-medium text-ink-900">{cn.client_name}</div>
                          <div className="text-xs text-ink-500 mt-0.5">{cn.client_document}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-ink-600 max-w-[180px] truncate" title={cn.motivo}>
                          {cn.motivo}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="font-black text-rose-700">${Number(cn.total).toFixed(2)}</div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg}`}
                          >
                            {style.icon}
                            {style.text}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
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
