import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ShoppingCart, Plus, TrendingDown, Calendar, Tag } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<string, string> = {
  "Arriendo":            "bg-blue-100 text-blue-700",
  "Servicios básicos":   "bg-cyan-100 text-cyan-700",
  "Insumos dentales":    "bg-lilac-100 text-lilac-700",
  "Equipos":             "bg-indigo-100 text-indigo-700",
  "Salarios":            "bg-orange-100 text-orange-700",
  "Publicidad":          "bg-pink-100 text-pink-700",
  "Suministros oficina": "bg-amber-100 text-amber-700",
  "Mantenimiento":       "bg-teal-100 text-teal-700",
  "Otros":               "bg-gray-100 text-gray-600",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Otros"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Tag size={10} />
      {category}
    </span>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:     "Efectivo",
  transferencia:"Transferencia",
  tarjeta:      "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:      "Crédito",
};

export default async function GastosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await assertPermission("/erp/gastos");
  const canEdit = await hasWritePermission("/erp/gastos");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  // Mes activo (default: mes actual)
  const now = new Date();
  const activeMonth = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = activeMonth.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  // Meses para el selector (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .eq("status", "registered")
    .order("expense_date", { ascending: false });

  const items = expenses ?? [];
  const totalMes    = items.reduce((s, e) => s + Number(e.total), 0);
  const totalIva    = items.reduce((s, e) => s + Number(e.iva_amount), 0);
  const totalSinIva = totalMes - totalIva;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-lilac-600 shrink-0" />
          <h1 className="text-xl font-bold text-ink-900">Gastos / Compras</h1>
        </div>
        {canEdit && (
          <Link
            href="/erp/gastos/nuevo"
            className="flex items-center gap-1.5 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium shadow-sm"
          >
            <Plus size={15} /> Registrar Gasto / Compra
          </Link>
        )}
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={15} className="text-ink-400 shrink-0" />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {months.map((m) => {
            const [y, mo] = m.split("-").map(Number);
            const label = new Date(y, mo - 1, 1).toLocaleDateString("es-EC", { month: "short", year: "2-digit" });
            return (
              <Link
                key={m}
                href={`/erp/gastos?month=${m}`}
                className={`shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  m === activeMonth
                    ? "bg-lilac-600 text-white"
                    : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stats del mes */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">Total del mes</div>
          <div className="text-lg font-bold text-red-600 leading-none">${totalMes.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">Subtotal s/IVA</div>
          <div className="text-lg font-bold text-ink-900 leading-none">${totalSinIva.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">IVA pagado</div>
          <div className="text-lg font-bold text-ink-900 leading-none">${totalIva.toFixed(2)}</div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="py-16 text-center text-ink-500">
            <TrendingDown size={36} className="text-lilac-200 mx-auto mb-3" />
            <p className="text-sm">No hay gastos registrados en {monthLabel}.</p>
            {canEdit && (
              <Link href="/erp/gastos/nuevo" className="text-lilac-600 hover:underline text-sm font-medium mt-1 inline-block">
                Registrar el primero
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-lilac-50">
            {items.map((exp) => (
              <Link
                key={exp.id}
                href={`/erp/gastos/${exp.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-lilac-50/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-ink-900 truncate">{exp.supplier_name}</span>
                    <CategoryBadge category={exp.category} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-ink-400">
                      {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
                    </span>
                    {exp.document_number && (
                      <span className="text-xs text-ink-400 font-mono">#{exp.document_number}</span>
                    )}
                    <span className="text-xs text-ink-400">{PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}</span>
                  </div>
                  {exp.description && (
                    <p className="text-xs text-ink-400 mt-0.5 truncate">{exp.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-red-600">${Number(exp.total).toFixed(2)}</div>
                  {Number(exp.iva_amount) > 0 && (
                    <div className="text-[11px] text-ink-400">IVA: ${Number(exp.iva_amount).toFixed(2)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
