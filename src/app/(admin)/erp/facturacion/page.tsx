import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileText, Plus, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function BillingDashboard() {
  await assertPermission("/erp/facturacion");
  const canEdit = await hasWritePermission("/erp/facturacion");
  const supabase = createAdminClient();

  const { data: invoices, count } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  const items = invoices || [];
  
  const getStatusStyle = (status: string, env?: string) => {
    switch(status) {
      case 'authorized': 
        const suffix = env === "2" ? "Producción" : "Pruebas";
        return { bg: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={14} />, text: `Autorizado (${suffix})` };
      case 'rejected': return { bg: 'bg-red-100 text-red-700', icon: <XCircle size={14} />, text: 'Rechazado' };
      case 'error': return { bg: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} />, text: 'Error' };
      case 'draft': return { bg: 'bg-amber-100 text-amber-700', icon: <Clock size={14} />, text: 'Borrador' };
      case 'cancelled': return { bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: <XCircle size={14} />, text: 'Anulado' };
      default: return { bg: 'bg-lilac-100 text-lilac-700', icon: <Clock size={14} />, text: status };
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <FileText className="text-lilac-600" />
            Facturación Electrónica SRI
          </h1>
          <p className="text-sm text-ink-600">
            Emite y gestiona comprobantes electrónicos autorizados por el SRI.
          </p>
        </div>
        {canEdit && (
          <Link
            href="/erp/facturacion/nueva"
            className="btn-primary flex items-center gap-2 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-md shadow-lilac-200"
          >
            <Plus size={16} />
            Emitir Factura
          </Link>
        )}
      </div>

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
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-ink-500">
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
                  const dateStr = new Date(inv.created_at).toLocaleDateString('es-EC');
                  
                  return (
                    <tr key={inv.id} className="hover:bg-lilac-50/30 transition-colors cursor-pointer">
                      <td className="px-5 py-4">
                        <Link href={`/erp/facturacion/${inv.id}`} className="block">
                          <div className="font-bold text-ink-900">{inv.invoice_number || 'Borrador'}</div>
                          <div className="text-[10px] text-ink-500 font-mono mt-0.5 truncate max-w-[150px]" title={inv.sri_access_key}>
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
                        <Link href={`/erp/facturacion/${inv.id}`} className="block">{dateStr}</Link>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link href={`/erp/facturacion/${inv.id}`} className="block">
                          <div className="font-bold text-ink-900">${Number(inv.total).toFixed(2)}</div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link href={`/erp/facturacion/${inv.id}`} className="block">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg}`}>
                            {style.icon}
                            {style.text}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
