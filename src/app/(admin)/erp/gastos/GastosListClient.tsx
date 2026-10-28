"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  TrendingDown,
  Calendar,
  Tag,
  Stethoscope,
  GraduationCap,
  Building2,
  Filter,
  Paperclip,
  Receipt,
  ArrowRight,
  Link2,
  X,
  Search,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { FacturaRecibida } from "@/lib/expense-types";
import { ExpenseArea, EXPENSE_AREA_CONFIG, resolveReceiptUrl } from "@/lib/expense-areas";
import { linkExpenseToFactura } from "./actions";

const CATEGORY_COLORS: Record<string, string> = {
  // 6 Categorías oficiales
  "Materiales e Instrumental": "bg-lilac-100 text-lilac-800 border-lilac-200",
  "Suministro":                "bg-amber-100 text-amber-800 border-amber-200",
  "Activo fijo":               "bg-blue-100 text-blue-800 border-blue-200",
  "Servicio":                  "bg-teal-100 text-teal-800 border-teal-200",
  "Software y Licencias":      "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Seguros y Suscripciones":   "bg-purple-100 text-purple-800 border-purple-200",

  // Históricas
  "Arriendo":            "bg-blue-100 text-blue-700 border-blue-200",
  "Servicios básicos":   "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Insumos dentales":    "bg-lilac-100 text-lilac-700 border-lilac-200",
  "Equipos":             "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Salarios":            "bg-orange-100 text-orange-700 border-orange-200",
  "Publicidad":          "bg-pink-100 text-pink-700 border-pink-200",
  "Suministros oficina": "bg-amber-100 text-amber-700 border-amber-200",
  "Mantenimiento":       "bg-teal-100 text-teal-700 border-teal-200",
  "Otros":               "bg-gray-100 text-gray-600 border-gray-200",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] ?? CATEGORY_COLORS["Otros"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
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
  efectivo:        "Efectivo",
  transferencia:   "Transferencia",
  tarjeta:         "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:         "Crédito",
};

interface Props {
  canEdit: boolean;
  activeMonth: string;
  monthLabel: string;
  activeAreaFilter: string;
  months: string[];
  monthlyClosedList: string[];
  annualClosedYearsList: number[];
  pendingFacturasMes: FacturaRecibida[];
  allAvailableFacturas: FacturaRecibida[];
  rawItems: any[];
  items: any[];
  totalMes: number;
  totalClinica: number;
  totalCursos: number;
  totalGeneral: number;
  totalIva: number;
}

export default function GastosListClient({
  canEdit,
  activeMonth,
  monthLabel,
  activeAreaFilter,
  months,
  monthlyClosedList,
  annualClosedYearsList,
  pendingFacturasMes,
  allAvailableFacturas,
  rawItems,
  items,
  totalMes,
  totalClinica,
  totalCursos,
  totalGeneral,
  totalIva,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const monthlyClosedSet = new Set(monthlyClosedList);
  const annualClosedYears = new Set(annualClosedYearsList);

  // Modal 1: Facturas SRI Pendientes del Mes
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingSearch, setPendingSearch] = useState("");

  // Modal 2: Relacionar Factura SRI a un gasto existente
  const [linkingExpense, setLinkingExpense] = useState<any | null>(null);
  const [linkingSearch, setLinkingSearch] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkingSuccess, setLinkingSuccess] = useState<string | null>(null);
  const [linkingError, setLinkingError] = useState<string | null>(null);

  const pendingCount = pendingFacturasMes.length;

  // Facturas pendientes del mes filtradas por búsqueda
  const filteredPendingInvoices = pendingFacturasMes.filter((f) => {
    if (!pendingSearch.trim()) return true;
    const q = pendingSearch.toLowerCase();
    return (
      (f.razon_social || "").toLowerCase().includes(q) ||
      (f.ruc_emisor || "").toLowerCase().includes(q) ||
      (f.numero_comprobante || "").toLowerCase().includes(q)
    );
  });

  // Facturas disponibles para relacionar
  const filteredAvailableFacturas = allAvailableFacturas.filter((f) => {
    if (!linkingSearch.trim()) return true;
    const q = linkingSearch.toLowerCase();
    return (
      (f.razon_social || "").toLowerCase().includes(q) ||
      (f.ruc_emisor || "").toLowerCase().includes(q) ||
      (f.numero_comprobante || "").toLowerCase().includes(q)
    );
  });

  // Ordenar sugerencias: coincidencias de RUC o nombre del proveedor arriba
  const sortedAvailableFacturas = [...filteredAvailableFacturas].sort((a, b) => {
    if (!linkingExpense) return 0;
    const expRuc = (linkingExpense.supplier_ruc || "").trim();
    const expName = (linkingExpense.supplier_name || "").toLowerCase().trim();
    const expDoc = (linkingExpense.document_number || "").trim();

    const aMatchRuc = expRuc && a.ruc_emisor === expRuc ? 3 : 0;
    const bMatchRuc = expRuc && b.ruc_emisor === expRuc ? 3 : 0;

    const aMatchDoc = expDoc && (a.numero_comprobante || "").includes(expDoc) ? 2 : 0;
    const bMatchDoc = expDoc && (b.numero_comprobante || "").includes(expDoc) ? 2 : 0;

    const aMatchName = expName && (a.razon_social || "").toLowerCase().includes(expName) ? 1 : 0;
    const bMatchName = expName && (b.razon_social || "").toLowerCase().includes(expName) ? 1 : 0;

    const aScore = aMatchRuc + aMatchDoc + aMatchName;
    const bScore = bMatchRuc + bMatchDoc + bMatchName;

    return bScore - aScore;
  });

  const handleLinkFactura = async (claveAcceso: string) => {
    if (!linkingExpense) return;
    setIsLinking(true);
    setLinkingError(null);

    const res = await linkExpenseToFactura(linkingExpense.id, claveAcceso);
    setIsLinking(false);

    if (res.success) {
      setLinkingSuccess("Factura vinculada exitosamente");
      setTimeout(() => {
        setLinkingExpense(null);
        setLinkingSuccess(null);
        startTransition(() => {
          router.refresh();
        });
      }, 700);
    } else {
      setLinkingError(res.error || "No se pudo vincular la factura");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-lilac-600 shrink-0" />
          <h1 className="text-xl font-bold text-ink-900">Gastos / Compras</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Facturas Pendientes por Registrar con número alarmado */}
          <button
            type="button"
            onClick={() => setIsPendingModalOpen(true)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
              pendingCount > 0
                ? "bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 ring-2 ring-purple-200/60"
                : "bg-gray-100 hover:bg-gray-200/80 text-gray-500 border border-gray-200 cursor-pointer"
            }`}
            title={
              pendingCount > 0
                ? `${pendingCount} facturas del SRI de este mes pendientes por registrar`
                : "No hay facturas SRI pendientes en este mes"
            }
          >
            <Receipt size={15} className={pendingCount > 0 ? "text-purple-700" : "text-gray-400"} />
            <span>Facturas pendientes por registrar</span>
            <span
              className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                pendingCount > 0
                  ? "bg-rose-500 text-white shadow-xs animate-pulse"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {pendingCount}
            </span>
          </button>

          {canEdit && (
            <Link
              href="/erp/gastos/nuevo"
              className="flex items-center gap-1.5 text-xs bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium shadow-sm"
            >
              <Plus size={15} />
              <span>Registrar Gasto / Compra</span>
            </Link>
          )}
        </div>
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

      {/* Tarjetas de Desglose por Destino */}
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
            { id: "clinica", label: `Clínica (${rawItems.filter((e: any) => e.resolvedArea === "clinica").length})` },
            { id: "cursos", label: `Cursos (${rawItems.filter((e: any) => e.resolvedArea === "cursos").length})` },
            { id: "general", label: `General (${rawItems.filter((e: any) => e.resolvedArea === "general").length})` },
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

      {/* Lista de Gastos */}
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
            {items.map((exp: any) => {
              const hasSriFactura = Boolean(exp.factura_recibida_clave_acceso);
              return (
                <div
                  key={exp.id}
                  className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-lilac-50/30 transition-colors group"
                >
                  <Link
                    href={`/erp/gastos/${exp.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink-900 truncate">{exp.supplier_name}</span>
                      <AreaBadge area={exp.resolvedArea} />
                      <CategoryBadge category={exp.category} />

                      {hasSriFactura ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-1.5 py-0.5 rounded-md font-bold" title="Factura SRI vinculada">
                          <Receipt size={10} /> SRI
                        </span>
                      ) : (
                        canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLinkingExpense(exp);
                              setLinkingSearch(exp.supplier_name || "");
                              setLinkingError(null);
                              setLinkingSuccess(null);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md transition shadow-2xs"
                            title="Vincular con una factura electrónica del SRI"
                          >
                            <Link2 size={11} className="text-indigo-600" />
                            <span>Relacionar Factura</span>
                          </button>
                        )
                      )}

                      {resolveReceiptUrl(exp) && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-lilac-50 text-lilac-700 border border-lilac-200 px-1.5 py-0.5 rounded-md font-semibold" title="Comprobante digital adjunto">
                          <Paperclip size={10} /> Respaldo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-ink-500 font-medium">
                        {new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-EC", { day: "numeric", month: "short" })}
                      </span>
                      {exp.document_number && (
                        <span className="text-xs text-ink-500 font-mono">#{exp.document_number}</span>
                      )}
                      <span className="text-xs text-ink-400 font-medium">
                        {PAYMENT_LABELS[exp.payment_method] ?? exp.payment_method}
                      </span>
                    </div>

                    {exp.description && (
                      <p className="text-xs text-ink-400 mt-0.5 truncate">{exp.description}</p>
                    )}
                  </Link>

                  <div className="text-right shrink-0">
                    <div className="font-extrabold text-red-600 text-sm">${Number(exp.total).toFixed(2)}</div>
                    {Number(exp.iva_amount) > 0 && (
                      <div className="text-[11px] text-ink-400 font-medium">IVA: ${Number(exp.iva_amount).toFixed(2)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL 1: FACTURAS SRI PENDIENTES DEL MES ── */}
      {isPendingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-lilac-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-lilac-100 flex items-center justify-between bg-gradient-to-r from-lilac-50/70 via-indigo-50/40 to-teal-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-950 flex items-center gap-2">
                    <span>Facturas SRI Recibidas Pendientes</span>
                    <span className="bg-lilac-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                      {pendingCount}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-500">
                    Facturas descargadas del SRI correspondientes a <b className="text-ink-800 capitalize">{monthLabel}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPendingModalOpen(false)}
                className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-white rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Buscador interno */}
            <div className="p-3 border-b border-lilac-100 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  placeholder="Buscar por proveedor, RUC o número de comprobante..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-lilac-50/30 font-medium"
                />
              </div>
            </div>

            {/* Listado de Facturas */}
            <div className="overflow-y-auto p-4 space-y-2.5 flex-1">
              {filteredPendingInvoices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredPendingInvoices.map((fac) => (
                    <div
                      key={fac.clave_acceso}
                      className="bg-white border border-lilac-100 rounded-xl p-3 flex flex-col justify-between shadow-2xs hover:border-lilac-300 transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-bold text-ink-900 leading-tight">
                            {fac.razon_social || "Proveedor"}
                          </span>
                          <span className="text-xs font-mono font-black text-ink-950 shrink-0">
                            ${Number(fac.total || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-ink-400 font-mono mt-1 flex items-center justify-between">
                          <span>#{fac.numero_comprobante || "N/A"}</span>
                          <span>{fac.fecha_emision}</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-lilac-50 flex items-center justify-between">
                        <span className="text-[10px] text-ink-400 font-mono truncate max-w-[120px]">
                          RUC: {fac.ruc_emisor}
                        </span>
                        {canEdit && (
                          <Link
                            href={`/erp/gastos/nuevo?factura=${fac.clave_acceso}`}
                            onClick={() => setIsPendingModalOpen(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 px-2.5 py-1 rounded-lg transition"
                          >
                            <span>Registrar Gasto</span>
                            <ArrowRight size={12} />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-ink-400 space-y-2">
                  <CheckCircle2 size={32} className="text-emerald-500 mx-auto opacity-70" />
                  <p className="text-xs font-medium">
                    {pendingCount === 0
                      ? `No hay facturas electrónicas SRI pendientes de registrar para ${monthLabel}.`
                      : "No se encontraron facturas que coincidan con la búsqueda."}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 border-t border-lilac-100 bg-lilac-50/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPendingModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white border border-lilac-200 text-ink-700 hover:bg-lilac-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: RELACIONAR FACTURA SRI CON GASTO EXISTENTE ── */}
      {linkingExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-indigo-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Link2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-950">
                    Relacionar Factura Electrónica SRI
                  </h3>
                  <p className="text-xs text-ink-500">
                    Vincula este gasto ya registrado con una factura recibida del SRI
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingExpense(null)}
                className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-white rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen del Gasto que se va a vincular */}
            <div className="px-5 py-3 bg-indigo-50/30 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Gasto Seleccionado</span>
                <span className="font-bold text-ink-900">{linkingExpense.supplier_name}</span>
                {linkingExpense.supplier_ruc && (
                  <span className="text-ink-500 font-mono text-[11px] ml-1.5">({linkingExpense.supplier_ruc})</span>
                )}
                {linkingExpense.document_number && (
                  <span className="text-ink-500 font-mono text-[11px] ml-1.5">#{linkingExpense.document_number}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-ink-400 block">{linkingExpense.expense_date}</span>
                <span className="font-mono font-black text-red-600 text-sm">
                  ${Number(linkingExpense.total).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Mensajes de feedback */}
            {linkingSuccess && (
              <div className="m-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{linkingSuccess}</span>
              </div>
            )}
            {linkingError && (
              <div className="m-3 p-2.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle size={15} className="text-red-600 shrink-0" />
                <span>{linkingError}</span>
              </div>
            )}

            {/* Buscador de facturas */}
            <div className="p-3 border-b border-indigo-100 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={linkingSearch}
                  onChange={(e) => setLinkingSearch(e.target.value)}
                  placeholder="Buscar factura por RUC, nombre de proveedor o comprobante..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50/20 font-medium"
                />
              </div>
            </div>

            {/* Listado de facturas SRI disponibles */}
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {sortedAvailableFacturas.length > 0 ? (
                sortedAvailableFacturas.map((fac) => {
                  const isRucMatch = linkingExpense.supplier_ruc && fac.ruc_emisor === linkingExpense.supplier_ruc;
                  const isDocMatch = linkingExpense.document_number && (fac.numero_comprobante || "").includes(linkingExpense.document_number);

                  return (
                    <div
                      key={fac.clave_acceso}
                      className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isRucMatch || isDocMatch
                          ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-200"
                          : "bg-white border-indigo-100 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-ink-900 truncate">
                            {fac.razon_social || "Proveedor"}
                          </span>
                          {(isRucMatch || isDocMatch) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded-full">
                              <Sparkles size={9} /> Coincidencia sugerida
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-500 font-mono flex items-center gap-3 mt-0.5 flex-wrap">
                          <span>RUC: {fac.ruc_emisor}</span>
                          <span>#{fac.numero_comprobante || "N/A"}</span>
                          <span>{fac.fecha_emision}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-mono font-black text-ink-950">
                            ${Number(fac.total || 0).toFixed(2)}
                          </div>
                          {Number(fac.iva || 0) > 0 && (
                            <div className="text-[10px] text-ink-400 font-mono">
                              IVA: ${Number(fac.iva).toFixed(2)}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isLinking}
                          onClick={() => handleLinkFactura(fac.clave_acceso)}
                          className="inline-flex items-center gap-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl shadow-xs transition"
                        >
                          <Link2 size={12} />
                          <span>Vincular</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-ink-400 space-y-1">
                  <p className="text-xs font-medium">No hay facturas SRI disponibles que coincidan con la búsqueda.</p>
                  <p className="text-[11px] text-ink-400">Todas las facturas descargadas ya están vinculadas o no coinciden.</p>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="px-5 py-3 border-t border-indigo-100 bg-indigo-50/40 flex justify-end">
              <button
                type="button"
                onClick={() => setLinkingExpense(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white border border-indigo-200 text-ink-700 hover:bg-indigo-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
