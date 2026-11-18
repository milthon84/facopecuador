"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Scale,
  ArrowLeft,
  Calendar,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  TrendingUp,
  Layers,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";

export interface AccountItem {
  code: string;
  name: string;
  balance: number;
}

interface Props {
  toDate: string;
  companyName: string;
  companyRuc: string;
  activosCorrientes: AccountItem[];
  activosNoCorrientes: AccountItem[];
  pasivosCorrientes: AccountItem[];
  pasivosNoCorrientes: AccountItem[];
  patrimonio: AccountItem[];
  ingresosTotal: number;
  gastosTotal: number;
  utilidadNeta: number;
  totalActivos: number;
  totalPasivos: number;
  totalPatrimonio: number;
  totalPasivosPatrimonio: number;
  cuadre: number;
}

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const r2 = (n: number) => Math.round(n * 100) / 100;

export default function BalanceGeneralClient({
  toDate,
  companyName,
  companyRuc,
  activosCorrientes,
  activosNoCorrientes,
  pasivosCorrientes,
  pasivosNoCorrientes,
  patrimonio,
  ingresosTotal,
  gastosTotal,
  utilidadNeta,
  totalActivos,
  totalPasivos,
  totalPatrimonio,
  totalPasivosPatrimonio,
  cuadre,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(toDate);
  const [exportingExcel, setExportingExcel] = useState(false);

  const isCuadrado = Math.abs(cuadre) < 0.01;

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    startTransition(() => {
      router.push(`/erp/contabilidad/balance?to=${newDate}`);
    });
  };

  const applyPreset = (preset: "hoy" | "fin_mes" | "mes_anterior" | "cierre_2025" | "cierre_2026") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    let target = toDate;
    if (preset === "hoy") {
      target = now.toISOString().split("T")[0];
    } else if (preset === "fin_mes") {
      target = new Date(y, m + 1, 0).toISOString().split("T")[0];
    } else if (preset === "mes_anterior") {
      target = new Date(y, m, 0).toISOString().split("T")[0];
    } else if (preset === "cierre_2025") {
      target = "2025-12-31";
    } else if (preset === "cierre_2026") {
      target = "2026-12-31";
    }

    handleDateChange(target);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const rows: any[] = [];

      // Encabezado
      rows.push({ A: companyName.toUpperCase() });
      rows.push({ A: "BALANCE GENERAL — ESTADO DE SITUACIÓN FINANCIERA (NIIF)" });
      rows.push({ A: `Fecha de Corte: ${toDate}`, B: `RUC: ${companyRuc}` });
      rows.push({});

      // ACTIVOS
      rows.push({ A: "1. ACTIVOS", B: "", C: totalActivos });
      rows.push({ A: "1.1 ACTIVOS CORRIENTES", B: "", C: r2(activosCorrientes.reduce((s, a) => s + a.balance, 0)) });
      activosCorrientes.forEach((a) => {
        rows.push({ A: a.code, B: a.name, C: a.balance });
      });

      if (activosNoCorrientes.length > 0) {
        rows.push({ A: "1.2 ACTIVOS NO CORRIENTES / FIJOS", B: "", C: r2(activosNoCorrientes.reduce((s, a) => s + a.balance, 0)) });
        activosNoCorrientes.forEach((a) => {
          rows.push({ A: a.code, B: a.name, C: a.balance });
        });
      }
      rows.push({ A: "TOTAL ACTIVOS", B: "", C: totalActivos });
      rows.push({});

      // PASIVOS
      rows.push({ A: "2. PASIVOS", B: "", C: totalPasivos });
      rows.push({ A: "2.1 PASIVOS CORRIENTES", B: "", C: r2(pasivosCorrientes.reduce((s, a) => s + a.balance, 0)) });
      pasivosCorrientes.forEach((a) => {
        rows.push({ A: a.code, B: a.name, C: a.balance });
      });

      if (pasivosNoCorrientes.length > 0) {
        rows.push({ A: "2.2 PASIVOS NO CORRIENTES", B: "", C: r2(pasivosNoCorrientes.reduce((s, a) => s + a.balance, 0)) });
        pasivosNoCorrientes.forEach((a) => {
          rows.push({ A: a.code, B: a.name, C: a.balance });
        });
      }
      rows.push({ A: "TOTAL PASIVOS", B: "", C: totalPasivos });
      rows.push({});

      // PATRIMONIO
      const totalPatrimonioNeto = r2(totalPatrimonio + utilidadNeta);
      rows.push({ A: "3. PATRIMONIO NETO", B: "", C: totalPatrimonioNeto });
      patrimonio.forEach((a) => {
        rows.push({ A: a.code, B: a.name, C: a.balance });
      });
      rows.push({ A: "3.X", B: "Utilidad Neta del Ejercicio", C: utilidadNeta });
      rows.push({ A: "TOTAL PATRIMONIO NETO", B: "", C: totalPatrimonioNeto });
      rows.push({});

      // ECUACIÓN FINAL
      rows.push({ A: "TOTAL PASIVO + PATRIMONIO", B: "", C: totalPasivosPatrimonio });
      rows.push({ A: "DIFERENCIA (CUADRE)", B: isCuadrado ? "CUADRADO" : "DESCUADRADO", C: cuadre });

      const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
      ws["!cols"] = [{ wch: 20 }, { wch: 45 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, "Balance_General");

      XLSX.writeFile(wb, `Balance_General_${toDate}.xlsx`);
    } catch (err) {
      console.error("Error al exportar:", err);
      alert("Hubo un error al generar el archivo Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const totalActivoCorriente = r2(activosCorrientes.reduce((s, a) => s + a.balance, 0));
  const totalActivoNoCorriente = r2(activosNoCorrientes.reduce((s, a) => s + a.balance, 0));
  const totalPasivoCorriente = r2(pasivosCorrientes.reduce((s, a) => s + a.balance, 0));
  const totalPasivoNoCorriente = r2(pasivosNoCorrientes.reduce((s, a) => s + a.balance, 0));
  const totalPatrimonioConUtilidad = r2(totalPatrimonio + utilidadNeta);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* ── BLOQUEO DE PANTALLA MIENTRAS CARGA O EXPORTA ── */}
      {(isPending || exportingExcel) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 border border-lilac-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-lilac-100 border-t-lilac-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-lilac-600">
                <Scale className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-2">
              {exportingExcel ? "Exportando a Excel..." : "Calculando Balance General..."}
            </h3>
            <p className="text-xs text-ink-500 leading-relaxed">
              Consolidando activos, pasivos, patrimonio y utilidad neta NIIF. Por favor, espere un momento.
            </p>
          </div>
        </div>
      )}

      {/* ── BARRA SUPERIOR DE ACCIONES (Idéntica al Libro Diario) ── */}
      <div className="print:hidden bg-white border border-lilac-100 rounded-2xl shadow-2xs p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/erp/contabilidad"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Volver a Contabilidad"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Scale size={18} className="text-lilac-600 shrink-0" />
              <h1 className="text-base font-bold text-ink-900">
                Balance General — Estado de Situación Financiera
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isCuadrado
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {isCuadrado ? "✓ Balance Cuadrado" : `Descuadre: $${fmt(Math.abs(cuadre))}`}
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              Corte acumulado al{" "}
              <strong className="text-ink-800">
                {new Date(toDate + "T12:00:00").toLocaleDateString("es-EC", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>{" "}
              · Ecuación Contable NIIF: Activo = Pasivo + Patrimonio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-ink-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Printer size={14} className="text-blue-600" />
            Imprimir / PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-sm transition-all"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* ── SELECTOR DE FECHA DE CORTE CON CHIPS RÁPIDOS ── */}
      <div className="print:hidden bg-white border border-lilac-100 rounded-2xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-lilac-600 shrink-0" />
          <span className="text-xs font-bold text-ink-800">Fecha de Corte (Hasta):</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 focus:bg-white"
          />
        </div>

        {/* Chips de períodos rápidos */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-ink-400 mr-1">Accesos rápidos:</span>
          <button
            type="button"
            onClick={() => applyPreset("hoy")}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-lilac-100 hover:text-lilac-800 text-ink-700 transition-colors"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => applyPreset("fin_mes")}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-lilac-100 hover:text-lilac-800 text-ink-700 transition-colors"
          >
            Fin de Este Mes
          </button>
          <button
            type="button"
            onClick={() => applyPreset("mes_anterior")}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-lilac-100 hover:text-lilac-800 text-ink-700 transition-colors"
          >
            Mes Anterior
          </button>
          <button
            type="button"
            onClick={() => applyPreset("cierre_2025")}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-lilac-100 hover:text-lilac-800 text-ink-700 transition-colors"
          >
            Cierre 2025
          </button>
          <button
            type="button"
            onClick={() => applyPreset("cierre_2026")}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-lilac-100 hover:text-lilac-800 text-ink-700 transition-colors"
          >
            Cierre 2026
          </button>
        </div>
      </div>

      {/* ── TARJETA RESUMEN DE LA ECUACIÓN CONTABLE FUNDAMENTAL ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
              Ecuación Contable Fundamental NIIF
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            {isCuadrado ? (
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                <CheckCircle2 size={13} /> Partida Doble Verificada (Diferencia: $0.00)
              </span>
            ) : (
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <AlertTriangle size={13} /> Descuadre detectado: ${fmt(Math.abs(cuadre))}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
          {/* TOTAL ACTIVOS */}
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-[11px] text-blue-200 uppercase font-semibold">Total Activos (1)</p>
            <p className="text-xl font-bold font-mono tracking-tight text-white mt-0.5">
              ${fmt(totalActivos)}
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
              Corr: ${fmt(totalActivoCorriente)} · No Corr: ${fmt(totalActivoNoCorriente)}
            </p>
          </div>

          <div className="text-2xl font-bold text-slate-400 hidden md:block">=</div>

          {/* TOTAL PASIVOS */}
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-[11px] text-rose-200 uppercase font-semibold">Total Pasivos (2)</p>
            <p className="text-xl font-bold font-mono tracking-tight text-white mt-0.5">
              ${fmt(totalPasivos)}
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
              Corr: ${fmt(totalPasivoCorriente)} · No Corr: ${fmt(totalPasivoNoCorriente)}
            </p>
          </div>

          <div className="text-2xl font-bold text-slate-400 hidden md:block">+</div>

          {/* TOTAL PATRIMONIO */}
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs border border-white/10">
            <p className="text-[11px] text-emerald-200 uppercase font-semibold">Patrimonio Neto (3)</p>
            <p className="text-xl font-bold font-mono tracking-tight text-white mt-0.5">
              ${fmt(totalPatrimonioConUtilidad)}
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
              Capital: ${fmt(totalPatrimonio)} · Utilidad: ${fmt(utilidadNeta)}
            </p>
          </div>
        </div>
      </div>

      {/* ── CUERPO DEL BALANCE: 2 COLUMNAS MODERNAS (Estilo Libro Diario) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── COLUMNA 1: ACTIVOS ── */}
        <div className="space-y-4">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
            {/* Header Tarjeta Activos */}
            <div className="px-5 py-3.5 border-b border-lilac-100 bg-blue-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                <h2 className="font-bold text-sm text-ink-900 uppercase tracking-wide">
                  1. ACTIVOS
                </h2>
              </div>
              <span className="font-mono text-sm font-bold text-blue-900">
                ${fmt(totalActivos)}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Subgrupo: Activo Corriente */}
              <div>
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 text-xs font-semibold text-ink-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    1.1 Activo Corriente (Efectivo, Bancos, Cartera)
                  </span>
                  <span className="font-mono text-blue-800 font-bold">${fmt(totalActivoCorriente)}</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {activosCorrientes.length === 0 ? (
                    <p className="text-xs text-ink-400 py-2 italic text-center">Sin cuentas corrientes</p>
                  ) : (
                    activosCorrientes.map((a) => (
                      <div
                        key={a.code}
                        className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                            {a.code}
                          </span>
                          <span className="text-ink-800 truncate" title={a.name}>
                            {a.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-ink-900 shrink-0">
                          ${fmt(a.balance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Subgrupo: Activo No Corriente */}
              {activosNoCorrientes.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 text-xs font-semibold text-ink-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      1.2 Activo No Corriente (Propiedad, Planta y Equipos)
                    </span>
                    <span className="font-mono text-blue-800 font-bold">${fmt(totalActivoNoCorriente)}</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {activosNoCorrientes.map((a) => (
                      <div
                        key={a.code}
                        className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                            {a.code}
                          </span>
                          <span className="text-ink-800 truncate" title={a.name}>
                            {a.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-ink-900 shrink-0">
                          ${fmt(a.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Total Activos */}
            <div className="border-t border-blue-100 bg-blue-50/80 px-5 py-3 flex justify-between items-center text-xs font-bold text-blue-950">
              <span className="uppercase tracking-wide">TOTAL ACTIVOS</span>
              <span className="font-mono text-base font-black">${fmt(totalActivos)}</span>
            </div>
          </div>
        </div>

        {/* ── COLUMNA 2: PASIVOS Y PATRIMONIO ── */}
        <div className="space-y-4">
          {/* Tarjeta Pasivos */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-lilac-100 bg-rose-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-rose-600"></div>
                <h2 className="font-bold text-sm text-ink-900 uppercase tracking-wide">
                  2. PASIVOS
                </h2>
              </div>
              <span className="font-mono text-sm font-bold text-rose-900">
                ${fmt(totalPasivos)}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Subgrupo: Pasivo Corriente */}
              <div>
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 text-xs font-semibold text-ink-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                    2.1 Pasivo Corriente (Proveedores, Impuestos, Obligaciones)
                  </span>
                  <span className="font-mono text-rose-800 font-bold">${fmt(totalPasivoCorriente)}</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {pasivosCorrientes.length === 0 ? (
                    <p className="text-xs text-ink-400 py-2 italic text-center">Sin pasivos corrientes</p>
                  ) : (
                    pasivosCorrientes.map((a) => (
                      <div
                        key={a.code}
                        className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shrink-0">
                            {a.code}
                          </span>
                          <span className="text-ink-800 truncate" title={a.name}>
                            {a.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-ink-900 shrink-0">
                          ${fmt(a.balance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Subgrupo: Pasivo No Corriente */}
              {pasivosNoCorrientes.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100 text-xs font-semibold text-ink-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      2.2 Pasivo No Corriente (Deudas a Largo Plazo)
                    </span>
                    <span className="font-mono text-rose-800 font-bold">${fmt(totalPasivoNoCorriente)}</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {pasivosNoCorrientes.map((a) => (
                      <div
                        key={a.code}
                        className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shrink-0">
                            {a.code}
                          </span>
                          <span className="text-ink-800 truncate" title={a.name}>
                            {a.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-ink-900 shrink-0">
                          ${fmt(a.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Total Pasivos */}
            <div className="border-t border-rose-100 bg-rose-50/80 px-5 py-3 flex justify-between items-center text-xs font-bold text-rose-950">
              <span className="uppercase tracking-wide">TOTAL PASIVOS</span>
              <span className="font-mono text-base font-black">${fmt(totalPasivos)}</span>
            </div>
          </div>

          {/* Tarjeta Patrimonio */}
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-lilac-100 bg-emerald-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                <h2 className="font-bold text-sm text-ink-900 uppercase tracking-wide">
                  3. PATRIMONIO NETO
                </h2>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-900">
                ${fmt(totalPatrimonioConUtilidad)}
              </span>
            </div>

            <div className="p-4 space-y-2">
              <div className="divide-y divide-slate-100">
                {patrimonio.map((a) => (
                  <div
                    key={a.code}
                    className="py-1.5 px-2 flex items-center justify-between hover:bg-slate-50/60 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shrink-0">
                        {a.code}
                      </span>
                      <span className="text-ink-800 truncate" title={a.name}>
                        {a.name}
                      </span>
                    </div>
                    <span className="font-mono font-semibold text-ink-900 shrink-0">
                      ${fmt(a.balance)}
                    </span>
                  </div>
                ))}

                {/* Fila Especial: Utilidad Neta del Ejercicio (Ingresos - Gastos) */}
                <div className="py-2.5 px-2 flex items-center justify-between bg-emerald-50/40 rounded-lg text-xs font-semibold mt-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className={utilidadNeta >= 0 ? "text-emerald-600" : "text-rose-600"} />
                    <span className="text-ink-900">
                      Utilidad Neta del Ejercicio (Ingresos − Gastos)
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      utilidadNeta >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    ${fmt(utilidadNeta)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Total Patrimonio */}
            <div className="border-t border-emerald-100 bg-emerald-50/80 px-5 py-3 flex justify-between items-center text-xs font-bold text-emerald-950">
              <span className="uppercase tracking-wide">TOTAL PATRIMONIO NETO</span>
              <span className="font-mono text-base font-black">${fmt(totalPatrimonioConUtilidad)}</span>
            </div>
          </div>

          {/* Tarjeta Cierre Total: Pasivo + Patrimonio */}
          <div
            className={`rounded-2xl p-4 flex items-center justify-between text-xs font-black shadow-2xs border ${
              isCuadrado
                ? "bg-slate-900 border-slate-800 text-white"
                : "bg-amber-100 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className={isCuadrado ? "text-emerald-400" : "text-amber-600"} />
              <span className="uppercase tracking-wide">TOTAL PASIVOS + PATRIMONIO</span>
            </div>
            <span className="font-mono text-lg">${fmt(totalPasivosPatrimonio)}</span>
          </div>
        </div>
      </div>

      {/* ── NOTA AL PIE Y FIRMAS FORMALES PARA IMPRESIÓN ── */}
      <div className="hidden print:block pt-12 text-xs font-mono">
        <div className="grid grid-cols-2 gap-12 text-center pt-16">
          <div className="border-t border-slate-900 pt-2">
            <p className="font-bold">REPRESENTANTE LEGAL</p>
            <p className="text-[10px] text-slate-500">C.I. / RUC</p>
          </div>
          <div className="border-t border-slate-900 pt-2">
            <p className="font-bold">CONTADOR GENERAL</p>
            <p className="text-[10px] text-slate-500">Reg. Profesional CPA</p>
          </div>
        </div>
      </div>

      <p className="print:hidden text-center text-xs text-ink-400 pt-2">
        Balance General generado a partir del Libro Diario y Mayores NIIF · Actualizado en tiempo real
      </p>
    </div>
  );
}
