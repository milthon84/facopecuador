import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { assertPermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

function getTipoId(doc: string): string {
  const d = (doc ?? "").trim();
  if (d === "9999999999999") return "07";
  if (d.length === 13) return "04";
  if (d.length === 10 && /^\d+$/.test(d)) return "05";
  if (/^[A-Za-z]/.test(d)) return "06";
  return "08";
}

export default async function ATSPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const now = new Date();
  const period = searchParams.period
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const supabase = createAdminClient();

  const [{ data: invoices }, { data: expenses }] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_number, created_at, client_name, client_document, subtotal_0, subtotal_15, iva_amount, total, sri_authorization_number, sri_environment")
      .gte("created_at", from + "T00:00:00")
      .lte("created_at", to   + "T23:59:59")
      .eq("sri_status", "authorized")
      .order("created_at"),
    supabase
      .from("expenses")
      .select("document_number, expense_date, supplier_name, supplier_ruc, subtotal_0, subtotal_15, iva_amount, total, category")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .eq("status", "registered")
      .order("expense_date"),
  ]);

  const ventas   = invoices  ?? [];
  const compras  = expenses  ?? [];

  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString("es-EC", {
    month: "long", year: "numeric",
  });

  const fmt = (n: number) => Number(n).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/erp/contabilidad"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink-900">ATS — Anexo Transaccional Simplificado</h1>
          <p className="text-xs text-ink-500">Formulario mensual para el SRI — {periodLabel}</p>
        </div>
        <a
          href={`/api/admin/contabilidad/ats-csv?period=${period}`}
          className="flex items-center gap-1.5 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Download size={15} /> Exportar CSV
        </a>
      </div>

      {/* Selector período */}
      <div className="flex gap-1 mb-5 overflow-x-auto">
        {months.map(m => (
          <Link
            key={m}
            href={`/erp/contabilidad/ats?period=${m}`}
            className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              m === period ? "bg-lilac-600 text-white" : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}
          >
            {new Date(Number(m.split("-")[0]), Number(m.split("-")[1]) - 1, 1)
              .toLocaleDateString("es-EC", { month: "short", year: "2-digit" })}
          </Link>
        ))}
      </div>

      <div className="space-y-5">

        {/* ── VENTAS ───────────────────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-50 bg-green-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} className="text-green-600" />
              <h2 className="font-semibold text-sm text-ink-800">Ventas (Facturas Emitidas)</h2>
            </div>
            <span className="text-xs text-ink-400">{ventas.length} comprobantes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-lilac-50/50 text-ink-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">N° Factura</th>
                  <th className="px-3 py-2 text-left">T.Id</th>
                  <th className="px-3 py-2 text-left">Identificación</th>
                  <th className="px-3 py-2 text-left">Razón Social</th>
                  <th className="px-3 py-2 text-right">Base 0%</th>
                  <th className="px-3 py-2 text-right">Base 15%</th>
                  <th className="px-3 py-2 text-right">IVA</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {ventas.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-ink-400">Sin ventas autorizadas en este período.</td></tr>
                ) : ventas.map((v, i) => (
                  <tr key={i} className="hover:bg-lilac-50/20">
                    <td className="px-3 py-2 font-mono text-ink-400">
                      {new Date(v.created_at).toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-3 py-2 font-mono text-ink-700">{v.invoice_number}</td>
                    <td className="px-3 py-2 text-center font-mono">{getTipoId(v.client_document)}</td>
                    <td className="px-3 py-2 font-mono">{v.client_document}</td>
                    <td className="px-3 py-2 text-ink-800 max-w-[140px] truncate">{v.client_name}</td>
                    <td className="px-3 py-2 text-right">{fmt(v.subtotal_0 ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{fmt(v.subtotal_15 ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-medium">{fmt(v.iva_amount ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(v.total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              {ventas.length > 0 && (
                <tfoot className="bg-lilac-50 text-xs font-bold border-t-2 border-lilac-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2">TOTALES ({ventas.length})</td>
                    <td className="px-3 py-2 text-right">{fmt(ventas.reduce((s,v)=>s+Number(v.subtotal_0??0),0))}</td>
                    <td className="px-3 py-2 text-right">{fmt(ventas.reduce((s,v)=>s+Number(v.subtotal_15??0),0))}</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmt(ventas.reduce((s,v)=>s+Number(v.iva_amount??0),0))}</td>
                    <td className="px-3 py-2 text-right">{fmt(ventas.reduce((s,v)=>s+Number(v.total??0),0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── COMPRAS ───────────────────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-lilac-50 bg-red-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} className="text-red-500" />
              <h2 className="font-semibold text-sm text-ink-800">Compras (Gastos Registrados)</h2>
            </div>
            <span className="text-xs text-ink-400">{compras.length} comprobantes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-lilac-50/50 text-ink-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">N° Factura</th>
                  <th className="px-3 py-2 text-left">RUC Proveedor</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                  <th className="px-3 py-2 text-right">Base 0%</th>
                  <th className="px-3 py-2 text-right">Base 15%</th>
                  <th className="px-3 py-2 text-right">IVA</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {compras.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-ink-400">Sin compras registradas en este período.</td></tr>
                ) : compras.map((c, i) => (
                  <tr key={i} className="hover:bg-lilac-50/20">
                    <td className="px-3 py-2 font-mono text-ink-400">{c.expense_date}</td>
                    <td className="px-3 py-2 font-mono text-ink-700">{c.document_number ?? "—"}</td>
                    <td className="px-3 py-2 font-mono">{c.supplier_ruc ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-800 max-w-[120px] truncate">{c.supplier_name}</td>
                    <td className="px-3 py-2 text-ink-500">{c.category}</td>
                    <td className="px-3 py-2 text-right">{fmt(c.subtotal_0 ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{fmt(c.subtotal_15 ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-medium">{fmt(c.iva_amount ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(c.total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              {compras.length > 0 && (
                <tfoot className="bg-lilac-50 text-xs font-bold border-t-2 border-lilac-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2">TOTALES ({compras.length})</td>
                    <td className="px-3 py-2 text-right">{fmt(compras.reduce((s,c)=>s+Number(c.subtotal_0??0),0))}</td>
                    <td className="px-3 py-2 text-right">{fmt(compras.reduce((s,c)=>s+Number(c.subtotal_15??0),0))}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{fmt(compras.reduce((s,c)=>s+Number(c.iva_amount??0),0))}</td>
                    <td className="px-3 py-2 text-right">{fmt(compras.reduce((s,c)=>s+Number(c.total??0),0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
