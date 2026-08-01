import { createAdminClient } from "@/lib/supabase/admin";
import { Receipt, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { assertPermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
}

export default async function ResumenIvaPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ period?: string }> }) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const now    = new Date();
  const period = searchParams.period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = period.split("-").map(Number);
  const from   = new Date(y, m - 1, 1).toISOString().split("T")[0];
  const to     = new Date(y, m, 0).toISOString().split("T")[0];

  const months: string[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const supabase = createAdminClient();

  // Ventas del período (facturas emitidas)
  const [{ data: closedRecords }, { data: invoices }, { data: expenses }] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("invoices")
      .select("invoice_number, client_name, client_document, issue_date, subtotal_0, subtotal_15, iva_amount, total, sri_status")
      .gte("issue_date", from).lte("issue_date", to)
      .neq("sri_status", "void")
      .order("issue_date"),
    supabase.from("expenses")
      .select("document_number, supplier_name, supplier_ruc, expense_date, subtotal_0, subtotal_15, iva_amount, total, category")
      .gte("expense_date", from).lte("expense_date", to)
      .eq("status", "registered")
      .order("expense_date"),
  ]);

  const closedSet = new Set((closedRecords ?? []).map((c: any) => c.period));

  // Totales ventas
  const ventasBase15  = r2((invoices || []).reduce((s, i) => s + Number(i.subtotal_15), 0));
  const ventasBase0   = r2((invoices || []).reduce((s, i) => s + Number(i.subtotal_0), 0));
  const ivaVentas     = r2((invoices || []).reduce((s, i) => s + Number(i.iva_amount), 0));
  const totalVentas   = r2((invoices || []).reduce((s, i) => s + Number(i.total), 0));

  // Totales compras
  const comprasBase15 = r2((expenses || []).reduce((s, e) => s + Number(e.subtotal_15), 0));
  const comprasBase0  = r2((expenses || []).reduce((s, e) => s + Number(e.subtotal_0), 0));
  const ivaCompras    = r2((expenses || []).reduce((s, e) => s + Number(e.iva_amount), 0));
  const totalCompras  = r2((expenses || []).reduce((s, e) => s + Number(e.total), 0));

  // IVA a pagar o a favor
  const ivaResult = r2(ivaVentas - ivaCompras);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/erp/contabilidad"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <Receipt className="text-lilac-600" /> Resumen IVA — Formulario 104
          </h1>
          <p className="text-sm text-ink-500">{periodLabel(period)} · Régimen General</p>
        </div>
        <form method="get">
          <select name="period" defaultValue={period}
            className="border border-lilac-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
            {months.map(mo => {
              const isClosed = closedSet.has(mo);
              return (
                <option key={mo} value={mo}>
                  {periodLabel(mo)}{isClosed ? " 🔒 (Cerrado)" : ""}
                </option>
              );
            })}
          </select>
          <button type="submit" className="ml-2 bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">Ver</button>
        </form>
      </div>

      {/* Resultado IVA */}
      <div className={`rounded-2xl border p-5 mb-6 flex items-center justify-between shadow-sm ${ivaResult > 0 ? "bg-red-50 border-red-200" : ivaResult < 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
        <div>
          <p className="text-sm font-semibold text-ink-600">
            {ivaResult > 0 ? "IVA a pagar al SRI" : ivaResult < 0 ? "Crédito tributario a favor" : "IVA en equilibrio"}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">IVA ventas ${fmt(ivaVentas)} − IVA compras ${fmt(ivaCompras)}</p>
        </div>
        <span className={`text-3xl font-bold tabular-nums ${ivaResult > 0 ? "text-red-700" : "text-green-700"}`}>
          ${fmt(Math.abs(ivaResult))}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Ventas */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-green-600 px-5 py-3 flex justify-between items-center">
            <h2 className="font-bold text-white">VENTAS (Facturas emitidas)</h2>
            <span className="text-white/80 text-sm">{(invoices || []).length} docs</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: "Base 0% IVA",       value: ventasBase0,  color: "text-ink-800" },
              { label: "Base gravada 15%",   value: ventasBase15, color: "text-ink-800" },
              { label: "IVA 15% generado",   value: ivaVentas,    color: "text-green-700 font-bold" },
              { label: "Total ventas",        value: totalVentas,  color: "text-ink-900 font-bold" },
            ].map(row => (
              <div key={row.label} className="flex justify-between border-b border-lilac-50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-sm text-ink-600">{row.label}</span>
                <span className={`text-sm tabular-nums ${row.color}`}>${fmt(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compras */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-red-600 px-5 py-3 flex justify-between items-center">
            <h2 className="font-bold text-white">COMPRAS (Gastos registrados)</h2>
            <span className="text-white/80 text-sm">{(expenses || []).length} docs</span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { label: "Base 0% IVA",        value: comprasBase0,  color: "text-ink-800" },
              { label: "Base gravada 15%",    value: comprasBase15, color: "text-ink-800" },
              { label: "IVA 15% pagado",      value: ivaCompras,    color: "text-red-600 font-bold" },
              { label: "Total compras",       value: totalCompras,  color: "text-ink-900 font-bold" },
            ].map(row => (
              <div key={row.label} className="flex justify-between border-b border-lilac-50 pb-1.5 last:border-0 last:pb-0">
                <span className="text-sm text-ink-600">{row.label}</span>
                <span className={`text-sm tabular-nums ${row.color}`}>${fmt(row.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalle facturas */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-lilac-50">
          <h3 className="font-semibold text-ink-900 text-sm">Detalle de Ventas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-lilac-50/50 text-ink-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">N° Factura</th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-right">Base 0%</th>
                <th className="px-4 py-2 text-right">Base 15%</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {(invoices || []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-400">Sin facturas en este período</td></tr>
              )}
              {(invoices || []).map((inv: any) => (
                <tr key={inv.invoice_number} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(inv.issue_date + "T12:00:00").toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                  <td className="px-4 py-2 max-w-[160px] truncate">{inv.client_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${fmt(Number(inv.subtotal_0))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${fmt(Number(inv.subtotal_15))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-green-700">${fmt(Number(inv.iva_amount))}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">${fmt(Number(inv.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle gastos */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lilac-50">
          <h3 className="font-semibold text-ink-900 text-sm">Detalle de Compras</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-lilac-50/50 text-ink-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">N° Doc.</th>
                <th className="px-4 py-2 text-left">Proveedor</th>
                <th className="px-4 py-2 text-right">Base 0%</th>
                <th className="px-4 py-2 text-right">Base 15%</th>
                <th className="px-4 py-2 text-right">IVA</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {(expenses || []).length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-ink-400">Sin gastos en este período</td></tr>
              )}
              {(expenses || []).map((exp: any, i: number) => (
                <tr key={i} className="hover:bg-lilac-50/20">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-EC")}</td>
                  <td className="px-4 py-2 font-mono">{exp.document_number ?? "—"}</td>
                  <td className="px-4 py-2 max-w-[160px] truncate">{exp.supplier_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${fmt(Number(exp.subtotal_0))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${fmt(Number(exp.subtotal_15))}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600">${fmt(Number(exp.iva_amount))}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">${fmt(Number(exp.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-ink-400 text-center mt-4">
        Datos para Formulario 104 · Declaración mensual de IVA · RUC Sociedad — Régimen General
      </p>
    </div>
  );
}
