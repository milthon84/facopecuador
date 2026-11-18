"use client";

import { useState, useTransition, useMemo } from "react";
import { Sparkles, Calendar, CheckCircle2, Clock, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { processBatchDepreciationAction } from "@/app/(admin)/erp/activos/actions";
import { extractAssetCode } from "@/lib/fixed-assets-utils";

type Asset = {
  id: string;
  name: string;
  code?: string | null;
  category: string;
  description?: string | null;
  purchase_date: string;
  purchase_value: number;
  salvage_value: number;
  useful_life_years: number;
  status: string;
};

type DepreciationRecord = {
  asset_id: string;
  period: string;
  monthly_amount: number;
};

type Props = {
  assets: Asset[];
  depreciations: DepreciationRecord[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function ProcesarDepreciacionModal({ assets, depreciations }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Período por defecto: este mes (YYYY-MM)
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState<string>(defaultPeriod);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Set de depreciaciones ya registradas
  const registeredMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of depreciations) {
      map.set(`${d.asset_id}_${d.period}`, Number(d.monthly_amount));
    }
    return map;
  }, [depreciations]);

  // Análisis de cada activo para el período seleccionado
  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(period)) return { items: [], pendingTotal: 0, pendingCount: 0, registeredCount: 0 };

    const [targetYear, targetMonth] = period.split("-").map(Number);

    let pendingTotal = 0;
    let pendingCount = 0;
    let registeredCount = 0;

    const items = assets.map((asset) => {
      const isRegistered = registeredMap.has(`${asset.id}_${period}`);
      const assetCode = extractAssetCode(asset);

      const start = new Date(asset.purchase_date + "T12:00:00");
      const startYear = start.getFullYear();
      const startMonth = start.getMonth() + 1;
      const monthsElapsed = (targetYear - startYear) * 12 + (targetMonth - startMonth);

      const usefulLife = Number(asset.useful_life_years || 10);
      const totalMonths = usefulLife * 12;
      const depreciable = Number(asset.purchase_value || 0) - Number(asset.salvage_value || 0);
      const monthly = r2(depreciable / totalMonths);

      let status: "registered" | "pending" | "future" | "completed";
      let statusLabel: string;

      if (isRegistered) {
        status = "registered";
        statusLabel = "Registrado";
        registeredCount++;
      } else if (monthsElapsed < 0) {
        status = "future";
        statusLabel = "Adquisición posterior";
      } else if (monthsElapsed >= totalMonths) {
        status = "completed";
        statusLabel = "Vida útil completada";
      } else {
        status = "pending";
        statusLabel = "Pendiente";
        pendingCount++;
        pendingTotal = r2(pendingTotal + monthly);
      }

      return {
        asset,
        code: assetCode,
        monthly,
        status,
        statusLabel,
      };
    });

    return { items, pendingTotal, pendingCount, registeredCount };
  }, [assets, period, registeredMap]);

  const handleProcess = () => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await processBatchDepreciationAction({ period });
        if (res.success) {
          setFeedback({
            type: "success",
            message: `¡Depreciación de ${period} procesada! Se generaron asientos para ${res.processedCount} activos por un total de $${res.totalAmount.toFixed(2)}.`,
          });
        }
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: err?.message || "Ocurrió un error al procesar las depreciaciones.",
        });
      }
    });
  };

  const setQuickPeriod = (offsetMonths: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths);
    setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setFeedback(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setFeedback(null);
        }}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-lilac-600 to-purple-700 hover:from-lilac-700 hover:to-purple-800 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-xs hover:shadow transition-all shrink-0 cursor-pointer"
      >
        <Sparkles size={16} className="text-yellow-300 shrink-0" />
        <span>Procesar Depreciación del Mes</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Procesar Depreciación Mensual Masiva"
        subtitle="Genera los asientos de diario y actualiza la depreciación acumulada de todos los activos."
        icon={<Sparkles size={20} className="text-lilac-600" />}
        loading={isPending}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Selector de Mes y Período */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center gap-1.5">
                  <Calendar size={14} className="text-lilac-600" />
                  Período a Depreciar (Mes/Año):
                </label>
                <input
                  type="month"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    setFeedback(null);
                  }}
                  disabled={isPending}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() => setQuickPeriod(0)}
                  disabled={isPending}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                    period === defaultPeriod
                      ? "bg-lilac-600 text-white border-lilac-600"
                      : "bg-white text-ink-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Este Mes
                </button>
                <button
                  type="button"
                  onClick={() => setQuickPeriod(-1)}
                  disabled={isPending}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-ink-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  Mes Anterior
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                feedback.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{feedback.message}</div>
            </div>
          )}

          {/* Tarjetas de Resumen del Período */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-lilac-50/60 border border-lilac-100 rounded-xl p-3">
              <span className="text-[11px] text-ink-500 block">Por Depreciar</span>
              <span className="text-lg font-bold text-purple-900">{preview.pendingCount} activos</span>
            </div>
            <div className="bg-green-50/60 border border-green-100 rounded-xl p-3">
              <span className="text-[11px] text-green-700 block">Total Gasto ({period})</span>
              <span className="text-lg font-bold text-green-800 font-mono">
                ${preview.pendingTotal.toFixed(2)}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 col-span-2 sm:col-span-1">
              <span className="text-[11px] text-ink-500 block">Ya Registrados</span>
              <span className="text-lg font-bold text-ink-700">{preview.registeredCount} activos</span>
            </div>
          </div>

          {/* Lista de Activos a Procesar */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-ink-700">
              <span>Detalle de Activos para {period}</span>
              <span className="text-ink-400 font-normal">{preview.items.length} activos evaluados</span>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
              {preview.items.length === 0 ? (
                <div className="p-4 text-center text-ink-400 text-xs">No hay activos activos registrados.</div>
              ) : (
                preview.items.map(({ asset, code, monthly, status, statusLabel }) => (
                  <div key={asset.id} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {code && (
                          <span className="font-mono text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200">
                            {code}
                          </span>
                        )}
                        <span className="font-medium text-ink-900 truncate">{asset.name}</span>
                      </div>
                      <span className="text-[11px] text-ink-400 block mt-0.5">
                        Costo: ${Number(asset.purchase_value).toFixed(2)} · Vida útil: {asset.useful_life_years} años
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-ink-900 block">${monthly.toFixed(2)}</span>
                      {status === "registered" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700 bg-green-50 px-1.5 py-0.2 rounded border border-green-200">
                          <CheckCircle2 size={10} /> Ya registrado
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          <Clock size={10} /> Pendiente
                        </span>
                      )}
                      {status === "future" && (
                        <span className="text-[10px] text-ink-400 italic">Mes posterior</span>
                      )}
                      {status === "completed" && (
                        <span className="text-[10px] text-ink-400 italic">Depreciado 100%</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Información Contable NIIF */}
          <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-[11px] text-purple-900 space-y-1">
            <p className="font-semibold flex items-center gap-1 text-purple-950">
              <ArrowRight size={13} className="text-purple-600" /> Asiento Contable Automático a Generar:
            </p>
            <p className="text-purple-800">
              • <strong>Débito (Debe):</strong> Cuentas <code>5.2.08.xx Depreciaciones (Gasto)</code> por ${preview.pendingTotal.toFixed(2)}
            </p>
            <p className="text-purple-800">
              • <strong>Crédito (Haber):</strong> Cuentas <code>1.2.02.xx Depreciación Acumulada</code> correspondientes
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="px-3.5 py-2 text-xs font-medium text-ink-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={isPending || preview.pendingCount === 0}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-lilac-600 to-purple-700 hover:from-lilac-700 hover:to-purple-800 disabled:opacity-50 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generando asientos...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-yellow-300" />
                  <span>
                    {preview.pendingCount > 0
                      ? `Generar ${preview.pendingCount} Depreciaciones ($${preview.pendingTotal.toFixed(2)})`
                      : "Todo al día para este mes"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </StandardModal>
    </>
  );
}
