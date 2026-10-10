import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ShoppingCart, Plus, TrendingDown, Calendar, Tag, Stethoscope, GraduationCap, Building2, Filter } from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { resolveExpenseArea, EXPENSE_AREA_CONFIG, ExpenseArea } from "@/lib/expense-areas";

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

function AreaBadge({ area }: { area: ExpenseArea }) {
  const cfg = EXPENSE_AREA_CONFIG[area] || EXPENSE_AREA_CONFIG.clinica;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.badgeCls}`}>
      {area === "clinica" && <Stethoscope size={10} />}
      {area === "cursos" && <GraduationCap size={10} />}
      {area === "general" && <Building2 size={10} />}
      {cfg.shortLabel}
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
  searchParams: Promise<{ month?: string; area?: string }>;
}) {
  await assertPermission("/erp/gastos");
  const canEdit = await hasWritePermission("/erp/gastos");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  // Mes activo (default: mes actual)
  const now = new Date();
  const activeMonth = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeAreaFilter = (searchParams.area || "all").toLowerCase();
  const [year, month] = activeMonth.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  // Meses para el selector (últimos 12)
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const [{ data: monthlyRecords }, { data: annualRecords }, { data: expenses }] = await Promise.all([
    supabase.from("monthly_closures").select("period").eq("status", "closed"),
    supabase.from("annual_closures").select("year").eq("status", "closed"),
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .eq("status", "registered")
      .order("expense_date", { ascending: false }),
  ]);

  const monthlyClosedSet = new Set((monthlyRecords ?? []).map((c: any) => c.period));
  const annualClosedYears = new Set((annualRecords ?? []).map((a: any) => Number(a.year)));

  const rawItems = (expenses ?? []).map((exp) => ({
    ...exp,
    resolvedArea: resolveExpenseArea(exp),
  }));

  const totalMes      = rawItems.reduce((s, e) => s + Number(e.total), 0);
  const totalClinica  = rawItems.filter((e) => e.resolvedArea === "clinica").reduce((s, e) => s + Number(e.total), 0);
  const totalCursos   = rawItems.filter((e) => e.resolvedArea === "cursos").reduce((s, e) => s + Number(e.total), 0);
  const totalGeneral  = rawItems.filter((e) => e.resolvedArea === "general").reduce((s, e) => s + Number(e.total), 0);
  const totalIva      = rawItems.reduce((s, e) => s + Number(e.iva_amount), 0);

  // Filtrar según área seleccionada
  const items = activeAreaFilter === "all"
    ? rawItems
    : rawItems.filter((e) => e.resolvedArea === activeAreaFilter);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
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
      <div className="flex items-center gap-2">
        <Calendar size={15} className="text-ink-400 shrink-0" />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {months.map((m) => {
            const yearNum = Number(m.split("-")[0]);
            const isAnnualClosed = annualClosedYears.has(yearNum);
            const isMonthlyClosed = monthlyClosedSet.has(m);
            const isSelected = m === activeMonth;
            const [y, mo] = m.split("-").map(Number);
            const label = new Date(y, mo - 1, 1).toLocaleDateString("es-EC", { month: "short", year: "2-digit" });

            let pillStyle = "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50";
            let badgeText = null;

            if (isAnnualClosed) {
              badgeText = "🏢 ANUAL";
              pillStyle = isSelected
                ? "bg-orange-600 text-white font-bold ring-2 ring-orange-400 shadow-sm"
                : "bg-orange-100 border border-orange-300 text-orange-950 hover:bg-orange-200 font-semibold";
            } else if (isMonthlyClosed) {
              badgeText = "🔒 CERRADO";
              pillStyle = isSelected
                ? "bg-yellow-500 text-white font-bold ring-2 ring-yellow-300 shadow-sm"
                : "bg-yellow-100 border border-yellow-300 text-yellow-950 hover:bg-yellow-200 font-semibold";
            } else if (isSelected) {
              pillStyle = "bg-lilac-600 text-white font-medium";
            }

            return (
              <Link
                key={m}
                href={`/erp/gastos?month=${m}${activeAreaFilter !== "all" ? `&area=${activeAreaFilter}` : ""}`}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors flex flex-col items-center justify-center leading-tight ${pillStyle}`}
              >
                {badgeText && (
                  <span className={`text-[8px] font-bold tracking-tight uppercase leading-none mb-0.5 ${
                    isSelected ? "text-white opacity-90" : isAnnualClosed ? "text-orange-800" : "text-yellow-800"
                  }`}>
                    {badgeText}
                  </span>
                )}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tarjetas de Desglose por Destino (Clínica vs Cursos vs General) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-2xl p-3 border border-lilac-100 shadow-xs">
          <div className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Total Mes</div>
          <div className="text-xl font-black text-red-600 mt-0.5">${totalMes.toFixed(2)}</div>
          <div className="text-[10px] text-ink-400 mt-0.5">IVA: ${totalIva.toFixed(2)}</div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-teal-100 shadow-xs">
          <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
            <Stethoscope size={11} /> Clínica Dental
          </div>
          <div className="text-xl font-black text-teal-900 mt-0.5">${totalClinica.toFixed(2)}</div>
          <div className="text-[10px] text-teal-600 mt-0.5">
            {totalMes > 0 ? `${((totalClinica / totalMes) * 100).toFixed(0)}% del total` : "0%"}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-indigo-100 shadow-xs">
          <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <GraduationCap size={11} /> Cursos / Educación
          </div>
          <div className="text-xl font-black text-indigo-900 mt-0.5">${totalCursos.toFixed(2)}</div>
          <div className="text-[10px] text-indigo-600 mt-0.5">
            {totalMes > 0 ? `${((totalCursos / totalMes) * 100).toFixed(0)}% del total` : "0%"}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 border border-amber-100 shadow-xs">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Building2 size={11} /> General / Admin
          </div>
          <div className="text-xl font-black text-amber-900 mt-0.5">${totalGeneral.toFixed(2)}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">
            {totalMes > 0 ? `${((totalGeneral / totalMes) * 100).toFixed(0)}% del total` : "0%"}
          </div>
        </div>
      </div>

      {/* Barra de Filtros por Destino */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white px-3 py-2 rounded-2xl border border-lilac-100 shadow-xs text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink-700">
          <Filter size={13} className="text-lilac-600" />
          <span>Filtrar por Área:</span>
        </div>
        <div className="flex items-center gap-1">
          {[
            { id: "all", label: `Todos (${rawItems.length})` },
            { id: "clinica", label: `Clínica (${rawItems.filter((e) => e.resolvedArea === "clinica").length})` },
            { id: "cursos", label: `Cursos (${rawItems.filter((e) => e.resolvedArea === "cursos").length})` },
            { id: "general", label: `General (${rawItems.filter((e) => e.resolvedArea === "general").length})` },
          ].map((btn) => (
            <Link
              key={btn.id}
              href={`/erp/gastos?month=${activeMonth}&area=${btn.id}`}
              className={`px-2.5 py-1 rounded-xl font-bold transition ${
                activeAreaFilter === btn.id
                  ? "bg-lilac-600 text-white shadow-xs"
                  : "bg-lilac-50/70 text-ink-600 hover:bg-lilac-100"
              }`}
            >
              {btn.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
        {items.length === 0 ? (
          <div className="py-16 text-center text-ink-500">
            <TrendingDown size={36} className="text-lilac-200 mx-auto mb-3" />
            <p className="text-sm">No hay gastos registrados en {monthLabel} para este filtro.</p>
            {canEdit && (
              <Link href="/erp/gastos/nuevo" className="text-lilac-600 hover:underline text-sm font-medium mt-1 inline-block">
                Registrar un gasto
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
                    <AreaBadge area={exp.resolvedArea} />
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
