"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Filter,
  Search,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  ListTree,
  X,
  SlidersHorizontal,
  FileText,
  Building2,
  DollarSign,
  Layers,
} from "lucide-react";

export interface AccountOption {
  code: string;
  name: string;
  type: string;
}

export interface MayorMovement {
  id: string;
  rawDate: string;
  date: string;
  mod: string;
  tp: string;
  asiento: string;
  referencia: string;
  concepto: string;
  debe: number;
  haber: number;
  saldo: number;
}

export interface MayorMonth {
  monthKey: string;
  monthName: string;
  movements: MayorMovement[];
  totalDebe: number;
  totalHaber: number;
  saldoFinalMes: number;
}

export interface MayorAccount {
  code: string;
  name: string;
  nature: "deudora" | "acreedora";
  initialBalance: number;
  initialBalanceDate: string;
  months: MayorMonth[];
  totalDebe: number;
  totalHaber: number;
  finalBalance: number;
  finalDate: string;
}

interface Props {
  initialDesde: string;
  initialHasta: string;
  initialCuenta: string;
  initialCuentaDesde: string;
  initialCuentaHasta: string;
  initialTipo: string;
  initialDoc: string;
  initialSoloConMovimientos: boolean;
  isGenerated: boolean;
  accountOptions: AccountOption[];
  allAccounts: any[];
  mayorAccounts: MayorAccount[];
  totalGeneralDebe: number;
  totalGeneralHaber: number;
  companyName: string;
  companyRuc: string;
}

const fmt = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt4 = (n: number) =>
  n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

function getModBadge(mod: string) {
  switch (mod) {
    case "ING":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">ING</span>;
    case "EGR":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">EGR</span>;
    case "FAC":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">FAC</span>;
    case "GAS":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">GAS</span>;
    case "NC":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">NC</span>;
    case "MAN":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">MAN</span>;
    case "CIE":
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-800 border border-orange-200">CIE</span>;
    default:
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{mod}</span>;
  }
}

export default function LibroMayorClient({
  initialDesde,
  initialHasta,
  initialCuenta,
  initialCuentaDesde,
  initialCuentaHasta,
  initialTipo,
  initialDoc,
  initialSoloConMovimientos,
  isGenerated,
  accountOptions,
  allAccounts,
  mayorAccounts,
  totalGeneralDebe,
  totalGeneralHaber,
  companyName,
  companyRuc,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Estados de filtros
  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);
  const [cuentaMode, setCuentaMode] = useState<"todas" | "especifica" | "rango">(
    initialCuenta ? "especifica" : initialCuentaDesde || initialCuentaHasta ? "rango" : "todas"
  );
  const [cuenta, setCuenta] = useState(initialCuenta);
  const [cuentaDesde, setCuentaDesde] = useState(initialCuentaDesde);
  const [cuentaHasta, setCuentaHasta] = useState(initialCuentaHasta);
  const [tipo, setTipo] = useState(initialTipo);
  const [doc, setDoc] = useState(initialDoc);
  const [soloConMovimientos, setSoloConMovimientos] = useState(initialSoloConMovimientos);
  const [tipoReporte, setTipoReporte] = useState<"contables" | "centros">("contables");

  // UI state
  const [showFilters, setShowFilters] = useState(!isGenerated);
  const [showF8Modal, setShowF8Modal] = useState(false);
  const [f8Target, setF8Target] = useState<"cuenta" | "cuentaDesde" | "cuentaHasta">("cuenta");
  const [f8Search, setF8Search] = useState("");
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Desactivar bloqueo de pantalla cuando se completen los cálculos y lleguen los nuevos datos
  useEffect(() => {
    setIsGenerating(false);
  }, [mayorAccounts, searchParams]);

  // Escuchar tecla F8 en el teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F8") {
        e.preventDefault();
        setF8Target("cuenta");
        setShowF8Modal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Quick period helpers
  const applyPreset = (preset: "este_mes" | "mes_anterior" | "trimestre" | "anio" | "todo") => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === "este_mes") {
      const d1 = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      const d2 = new Date(y, m + 1, 0).toISOString().split("T")[0];
      setDesde(d1);
      setHasta(d2);
    } else if (preset === "mes_anterior") {
      const prevM = m === 0 ? 11 : m - 1;
      const prevY = m === 0 ? y - 1 : y;
      const d1 = `${prevY}-${String(prevM + 1).padStart(2, "0")}-01`;
      const d2 = new Date(prevY, prevM + 1, 0).toISOString().split("T")[0];
      setDesde(d1);
      setHasta(d2);
    } else if (preset === "trimestre") {
      const qStartMonth = Math.floor(m / 3) * 3;
      const d1 = `${y}-${String(qStartMonth + 1).padStart(2, "0")}-01`;
      const d2 = new Date(y, qStartMonth + 3, 0).toISOString().split("T")[0];
      setDesde(d1);
      setHasta(d2);
    } else if (preset === "anio") {
      setDesde(`${y}-01-01`);
      setHasta(`${y}-12-31`);
    } else if (preset === "todo") {
      setDesde(`2024-01-01`);
      setHasta(`${y}-12-31`);
    }
  };

  const handleGenerar = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsGenerating(true);
    const params = new URLSearchParams();
    params.set("generar", "1");
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (cuentaMode === "especifica" && cuenta) {
      params.set("cuenta", cuenta);
    } else if (cuentaMode === "rango") {
      if (cuentaDesde) params.set("cuentaDesde", cuentaDesde);
      if (cuentaHasta) params.set("cuentaHasta", cuentaHasta);
    }
    if (tipo && tipo !== "todos") params.set("tipo", tipo);
    if (doc) params.set("doc", doc);
    params.set("soloConMovimientos", soloConMovimientos ? "true" : "false");

    setShowFilters(false);
    startTransition(() => {
      router.push(`/erp/contabilidad/mayor?${params.toString()}`);
    });
  };

  const handleResetFilters = () => {
    applyPreset("este_mes");
    setCuentaMode("todas");
    setCuenta("");
    setCuentaDesde("");
    setCuentaHasta("");
    setTipo("todos");
    setDoc("");
    setSoloConMovimientos(true);
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

      // Encabezado institucional
      rows.push({ A: companyName.toUpperCase() });
      rows.push({
        A: `MAYOR GENERAL CONTABLE`,
        C: `Fecha Emisión: ${new Date().toLocaleDateString("es-EC")}`,
      });
      rows.push({
        A: `Desde: ${cuentaDesde || cuenta || "Todas"}  Hasta: ${cuentaHasta || cuenta || "Todas"}`,
        D: `Período: ${desde}  al  ${hasta}`,
      });
      rows.push({}); // Fila en blanco

      for (const acc of mayorAccounts) {
        // Cabecera de cuenta
        rows.push({
          A: `CODIGO: ${acc.code}`,
          C: `NOMBRE: ${acc.name}`,
          H: `Naturaleza: ${acc.nature.toUpperCase()}`,
        });

        // Saldo anterior
        rows.push({
          A: "",
          B: "",
          C: "",
          D: `Saldo Al ${acc.initialBalanceDate} ----->`,
          I: acc.initialBalance,
        });

        // Encabezados de columnas
        rows.push({
          A: "FECHA",
          B: "MOD",
          C: "TP",
          D: "ASIENTO",
          E: "REFEREN.",
          F: "CONCEPTO DEL MOVIMIENTO",
          G: "DEBE ($)",
          H: "HABER ($)",
          I: "SALDO ($)",
        });

        for (const month of acc.months) {
          for (const mov of month.movements) {
            rows.push({
              A: mov.date,
              B: mov.mod,
              C: mov.tp,
              D: mov.asiento,
              E: mov.referencia,
              F: mov.concepto,
              G: mov.debe > 0 ? mov.debe : 0,
              H: mov.haber > 0 ? mov.haber : 0,
              I: mov.saldo,
            });
          }

          // Subtotal Mes
          rows.push({
            A: "",
            B: "",
            C: "",
            D: `TOTAL MES: ${month.monthName} ----->`,
            E: "",
            F: "",
            G: month.totalDebe,
            H: month.totalHaber,
            I: month.saldoFinalMes,
          });
        }

        // Total Final Cuenta
        rows.push({
          A: "",
          B: "",
          C: "",
          D: `TOTAL AL: ${acc.finalDate} ----->`,
          E: "",
          F: "",
          G: acc.totalDebe,
          H: acc.totalHaber,
          I: acc.finalBalance,
        });

        rows.push({}); // Separador entre cuentas
      }

      // Total General del Reporte
      rows.push({
        A: "TOTAL GENERAL MAYOR",
        F: "SUMAS DEL PERÍODO",
        G: totalGeneralDebe,
        H: totalGeneralHaber,
        I: r2(Math.abs(totalGeneralDebe - totalGeneralHaber)),
      });

      const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
      ws["!cols"] = [
        { wch: 12 }, // Fecha
        { wch: 8 },  // MOD
        { wch: 6 },  // TP
        { wch: 16 }, // Asiento
        { wch: 14 }, // Referen
        { wch: 42 }, // Concepto
        { wch: 14 }, // Debe
        { wch: 14 }, // Haber
        { wch: 14 }, // Saldo
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Libro_Mayor");
      const filename = `Libro_Mayor_${desde}_a_${hasta}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Hubo un error al generar el archivo Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const filteredAccountOptions = useMemo(() => {
    if (!f8Search) return accountOptions;
    const q = f8Search.toLowerCase();
    return accountOptions.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [accountOptions, f8Search]);

  const selectAccountF8 = (code: string) => {
    if (f8Target === "cuenta") {
      setCuenta(code);
      setCuentaMode("especifica");
    } else if (f8Target === "cuentaDesde") {
      setCuentaDesde(code);
      setCuentaMode("rango");
    } else if (f8Target === "cuentaHasta") {
      setCuentaHasta(code);
      setCuentaMode("rango");
    }
    setShowF8Modal(false);
    setF8Search("");
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* ── BLOQUEO DE PANTALLA MIENTRAS GENERA EL LIBRO MAYOR (Como el resto de procesos del sistema) ── */}
      {(isGenerating || isPending) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 border border-purple-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Spinner contable con detalles lilas */}
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-purple-600">
                <BookOpen className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-2">
              Generando Libro Mayor...
            </h3>
            <p className="text-xs text-ink-500 leading-relaxed mb-4">
              Calculando saldos iniciales, movimientos cronológicos y saldos acumulados progresivos. Por favor, espere un momento.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-700">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
              Procesamiento contable NIIF
            </div>
          </div>
        </div>
      )}

      {/* ── BLOQUEO MIENTRAS EXPORTA A EXCEL ── */}
      {exportingExcel && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/95 border border-emerald-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                <FileSpreadsheet className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-2">
              Exportando a Excel...
            </h3>
            <p className="text-xs text-ink-500 leading-relaxed">
              Generando archivo .xlsx estructurado por cuenta con saldos y subtotales.
            </p>
          </div>
        </div>
      )}

      {/* ── BARRA SUPERIOR DE ACCIONES (Oculta en Impresión) ── */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-lilac-100 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/erp/contabilidad"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            title="Volver a Contabilidad"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-purple-600" />
              <h1 className="text-lg font-bold text-ink-900">Libro Mayor General</h1>
              <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                NIIF / ERP
              </span>
            </div>
            <p className="text-xs text-ink-400">
              Movimientos contables detallados, saldos iniciales y saldos progresivos por cuenta
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
              showFilters
                ? "bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-100"
                : "bg-white text-ink-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Filter size={14} className={showFilters ? "text-purple-600" : "text-ink-400"} />
            {showFilters ? "Ocultar Filtros" : "Modificar Filtros"}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isGenerated && (
            <>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-ink-700 hover:bg-slate-50 shadow-sm"
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
                {exportingExcel ? "Exportando..." : "Exportar Excel"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── PANEL DE FILTROS DEL INFORME (Matching Screenshot) ── */}
      {showFilters && (
        <form
          onSubmit={handleGenerar}
          className="print:hidden bg-white border border-purple-100 rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-purple-600" />
              <h2 className="text-sm font-bold text-ink-900 uppercase tracking-wide">
                Filtros del Informe
              </h2>
            </div>

            {/* Accesos rápidos de período */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-ink-400 mr-1">Período rápido:</span>
              <button
                type="button"
                onClick={() => applyPreset("este_mes")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-ink-700 transition-colors"
              >
                Este Mes
              </button>
              <button
                type="button"
                onClick={() => applyPreset("mes_anterior")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-ink-700 transition-colors"
              >
                Mes Anterior
              </button>
              <button
                type="button"
                onClick={() => applyPreset("trimestre")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-ink-700 transition-colors"
              >
                Trimestre
              </button>
              <button
                type="button"
                onClick={() => applyPreset("anio")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-purple-100 hover:text-purple-800 text-ink-700 transition-colors"
              >
                Año en Curso
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna 1: Fechas y Módulos */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-700">
                <span>RANGO DE FECHAS</span>
                <span className="text-[10px] text-ink-400 font-normal">Obligatorio</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">DESDE</label>
                  <input
                    type="date"
                    required
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-500 mb-1">HASTA</label>
                  <input
                    type="date"
                    required
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">
                  Tipo de Comprobante / Módulo
                </label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                >
                  <option value="todos">Todos los Comprobantes</option>
                  <option value="invoice">Facturas de Clientes (Ventas / Cobros)</option>
                  <option value="expense">Facturas de Proveedores (Gastos / Pagos)</option>
                  <option value="manual">Asientos Manuales / Ajustes</option>
                  <option value="cobro">Solo Cobros / Recaudaciones</option>
                  <option value="pago">Solo Pagos / Cruces Bancarios</option>
                  <option value="credit_note">Notas de Crédito</option>
                  <option value="cierre">Asientos de Cierre Contable</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-600 mb-1">
                  N° Documento / Referencia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1437, FAC-001, Cheque #450"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                />
              </div>
            </div>

            {/* Columna 2: Cuentas Contables y Presione F8 */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-ink-700">
                <span>SELECCIÓN DE CUENTAS</span>
                <button
                  type="button"
                  onClick={() => {
                    setF8Target(cuentaMode === "rango" ? "cuentaDesde" : "cuenta");
                    setShowF8Modal(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-0.5 rounded-lg transition-colors border border-purple-200"
                  title="Abrir Plan de Cuentas (Tecla F8)"
                >
                  <ListTree size={12} />
                  Presione F8 (Ver Lista)
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cuentaMode"
                    checked={cuentaMode === "todas"}
                    onChange={() => setCuentaMode("todas")}
                    className="accent-purple-600"
                  />
                  <span>Todas</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cuentaMode"
                    checked={cuentaMode === "especifica"}
                    onChange={() => setCuentaMode("especifica")}
                    className="accent-purple-600"
                  />
                  <span>Una Cuenta</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cuentaMode"
                    checked={cuentaMode === "rango"}
                    onChange={() => setCuentaMode("rango")}
                    className="accent-purple-600"
                  />
                  <span>Rango Cuentas</span>
                </label>
              </div>

              {cuentaMode === "especifica" && (
                <div>
                  <label className="block text-[11px] font-medium text-ink-600 mb-1">
                    Cuenta Contable de Movimiento
                  </label>
                  <select
                    value={cuenta}
                    onChange={(e) => setCuenta(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-ink-800 font-mono focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                  >
                    <option value="">-- Seleccione o busque una cuenta --</option>
                    {accountOptions.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {cuentaMode === "rango" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-ink-500 mb-1">
                      CUENTA DESDE
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="1.1.01.01"
                        value={cuentaDesde}
                        onChange={(e) => setCuentaDesde(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setF8Target("cuentaDesde");
                          setShowF8Modal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-purple-600 border border-slate-200 rounded-xl hover:bg-purple-50"
                        title="Buscar cuenta desde"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-ink-500 mb-1">
                      CUENTA HASTA
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="1.1.02.02"
                        value={cuentaHasta}
                        onChange={(e) => setCuentaHasta(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-ink-800 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setF8Target("cuentaHasta");
                          setShowF8Modal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-purple-600 border border-slate-200 rounded-xl hover:bg-purple-50"
                        title="Buscar cuenta hasta"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {cuentaMode === "todas" && (
                <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-xs text-purple-900 leading-relaxed">
                  ✓ Se procesarán todas las cuentas con actividad contable dentro del período.
                </div>
              )}

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-700">
                  <input
                    type="checkbox"
                    checked={soloConMovimientos}
                    onChange={(e) => setSoloConMovimientos(e.target.checked)}
                    className="accent-purple-600 rounded"
                  />
                  <span>Ocultar cuentas con saldo cero y sin movimientos</span>
                </label>
              </div>
            </div>

            {/* Columna 3: Selección de Tipo de Reporte y Botón Generar */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-ink-700">SELECCIÓN DE REPORTE</div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-ink-900">
                    <input
                      type="radio"
                      name="tipoReporte"
                      checked={tipoReporte === "contables"}
                      onChange={() => setTipoReporte("contables")}
                      className="accent-purple-600"
                    />
                    <span>Mayores Contables (General por Cuenta)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-ink-500">
                    <input
                      type="radio"
                      name="tipoReporte"
                      checked={tipoReporte === "centros"}
                      onChange={() => setTipoReporte("centros")}
                      className="accent-purple-600"
                    />
                    <span>Mayores Centros de Costo / Establecimiento</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50 text-sm"
                >
                  <BookOpen size={16} />
                  {isPending ? "Generando Libro Mayor..." : "GENERAR LIBRO MAYOR"}
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 py-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <RotateCcw size={12} />
                  Restablecer valores por defecto
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── CUANDO NO SE HA GENERADO EL REPORTE ── */}
      {!isGenerated && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <div className="w-14 h-14 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center mx-auto border border-purple-100">
            <BookOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-ink-900">
            Configure los criterios del informe arriba
          </h3>
          <p className="text-xs text-ink-500 max-w-md mx-auto">
            Seleccione el período de fechas, cuenta contable específica o rango de cuentas, y haga
            clic en <strong>GENERAR LIBRO MAYOR</strong> para calcular saldos iniciales, movimientos y
            saldos progresivos.
          </p>
        </div>
      )}

      {/* ── REPORTE MODERNO: MAYOR GENERAL CONTABLE (Estilo Libro Diario NIIF) ── */}
      {isGenerated && (
        <div className="space-y-4">
          {/* Barra Resumen de Criterios y Totales (Pantalla) */}
          <div className="print:hidden bg-white border border-lilac-100 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <BookOpen size={16} className="text-purple-600" />
                <span className="font-bold text-sm text-ink-900">
                  Mayor General Contable NIIF
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-800 border-purple-200">
                  {mayorAccounts.length} Cuentas con actividad
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    Math.abs(totalGeneralDebe - totalGeneralHaber) < 0.01
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {Math.abs(totalGeneralDebe - totalGeneralHaber) < 0.01
                    ? "✓ Partida Doble Cuadrada"
                    : `Descuadre: $${fmt(Math.abs(totalGeneralDebe - totalGeneralHaber))}`}
                </span>
              </div>
              <p className="text-xs text-ink-500">
                Período: <strong className="text-ink-800">{formatDateDMYLocal(desde)}</strong> al{" "}
                <strong className="text-ink-800">{formatDateDMYLocal(hasta)}</strong> · Cuenta:{" "}
                <strong className="text-ink-800">
                  {cuenta
                    ? `${cuenta}`
                    : cuentaDesde || cuentaHasta
                    ? `${cuentaDesde || "Inicio"} a ${cuentaHasta || "Fin"}`
                    : "Todas las Cuentas"}
                </strong> · Tipo: <strong className="text-ink-800">{tipo === "todos" ? "Todos los Comprobantes" : tipo}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3 bg-purple-50/60 border border-purple-100 rounded-xl px-3.5 py-2 shrink-0 self-start md:self-auto">
              <div className="text-right">
                <p className="text-[10px] uppercase font-semibold text-purple-700">Total Débitos</p>
                <p className="font-mono text-xs font-bold text-emerald-700">${fmt(totalGeneralDebe)}</p>
              </div>
              <div className="w-px h-6 bg-purple-200"></div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-semibold text-purple-700">Total Créditos</p>
                <p className="font-mono text-xs font-bold text-blue-700">${fmt(totalGeneralHaber)}</p>
              </div>
            </div>
          </div>

          {/* CONTENEDOR DEL DOCUMENTO FORMAL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none space-y-6">
            {/* Encabezado Oficial del Reporte */}
            <div className="border-b-2 border-slate-900 pb-4">
              <div className="flex justify-between items-start text-xs">
                <div>
                  <h2 className="font-black text-base text-slate-900 tracking-wide">
                    {companyName.toUpperCase()}
                  </h2>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Fecha de Emisión: <strong>{new Date().toLocaleDateString("es-EC")}</strong>
                  </div>
                  {companyRuc && (
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      RUC: {companyRuc}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <h3 className="text-lg font-black text-slate-900 tracking-wider uppercase">
                    MAYOR GENERAL CONTABLE
                  </h3>
                  <div className="text-xs text-slate-600 font-medium mt-1 flex items-center justify-center gap-4">
                    <span>
                      Cuentas: <strong>{cuentaDesde || cuenta || "1.0.00.00"}</strong> al <strong>{cuentaHasta || cuenta || "9.9.99.99"}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Período: <strong>{formatDateDMYLocal(desde)}</strong> al <strong>{formatDateDMYLocal(hasta)}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500 font-mono">
                  Página 1 de 1
                </div>
              </div>
            </div>

            {/* Lista de Cuentas */}
            {mayorAccounts.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No se encontraron movimientos contables para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-6">
                {mayorAccounts.map((acc) => (
                  <div
                    key={acc.code}
                    className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs break-inside-avoid"
                  >
                    {/* Encabezado de la Cuenta */}
                    <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg shrink-0">
                          {acc.code}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-ink-900">{acc.name}</h4>
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            Naturaleza {acc.nature}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                        <span className="text-xs text-slate-500 font-medium">Saldo Inicial al {acc.initialBalanceDate}:</span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            acc.initialBalance < 0 ? "text-rose-600" : "text-ink-900"
                          }`}
                        >
                          ${fmt(acc.initialBalance)}
                        </span>
                      </div>
                    </div>

                    {/* Tabla de Movimientos */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100/70 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2 text-left w-24">Fecha</th>
                            <th className="px-2 py-2 text-center w-14">Mod</th>
                            <th className="px-2 py-2 text-center w-12">TP</th>
                            <th className="px-3 py-2 text-left w-36">Asiento</th>
                            <th className="px-3 py-2 text-left w-44">Referencia</th>
                            <th className="px-3 py-2 text-left min-w-[200px]">Concepto del Movimiento</th>
                            <th className="px-3 py-2 text-right w-28">Debe</th>
                            <th className="px-3 py-2 text-right w-28">Haber</th>
                            <th className="px-3 py-2 text-right w-32">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {acc.months.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-4 text-center text-slate-400 italic">
                                Sin movimientos en el período seleccionado. Saldo al corte: ${fmt(acc.finalBalance)}
                              </td>
                            </tr>
                          ) : (
                            acc.months.map((m) => (
                              <React.Fragment key={m.monthKey}>
                                {m.movements.map((mov) => (
                                  <tr
                                    key={mov.id}
                                    className="hover:bg-purple-50/25 transition-colors text-[11px]"
                                  >
                                    <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">
                                      {mov.date}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {getModBadge(mov.mod)}
                                    </td>
                                    <td className="px-2 py-2 text-center font-mono text-slate-500">
                                      {mov.tp}
                                    </td>
                                    <td className="px-3 py-2 font-mono font-semibold text-purple-950 whitespace-nowrap">
                                      {mov.asiento}
                                    </td>
                                    <td className="px-3 py-2 font-mono text-slate-700 font-medium whitespace-nowrap">
                                      {mov.referencia || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-slate-800 leading-snug">
                                      {mov.concepto}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-medium">
                                      {mov.debe > 0 ? `$${fmt(mov.debe)}` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-medium">
                                      {mov.haber > 0 ? `$${fmt(mov.haber)}` : "—"}
                                    </td>
                                    <td
                                      className={`px-3 py-2 text-right font-mono font-bold ${
                                        mov.saldo < 0 ? "text-rose-600" : "text-slate-900"
                                      }`}
                                    >
                                      ${fmt(mov.saldo)}
                                    </td>
                                  </tr>
                                ))}

                                {/* Subtotal del Mes (TOTAL MES) */}
                                <tr className="bg-purple-50/40 font-bold border-t border-b border-purple-100 text-xs text-purple-950">
                                  <td colSpan={5} className="px-4 py-2">
                                    <span className="inline-flex items-center gap-1.5 font-bold text-purple-900">
                                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                                      TOTAL MES: {m.monthName}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right text-purple-700 text-[11px] font-normal">
                                    Subtotal del mes:
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-purple-950">
                                    ${fmt(m.totalDebe)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-purple-950">
                                    ${fmt(m.totalHaber)}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-mono font-bold ${
                                      m.saldoFinalMes < 0 ? "text-rose-600" : "text-purple-950"
                                    }`}
                                  >
                                    ${fmt(m.saldoFinalMes)}
                                  </td>
                                </tr>
                              </React.Fragment>
                            ))
                          )}
                        </tbody>
                        {/* Total Final de la Cuenta (TOTAL AL) */}
                        <tfoot className="bg-slate-100 font-black border-t-2 border-b-2 border-slate-800 text-xs text-ink-950">
                          <tr>
                            <td colSpan={5} className="px-4 py-2.5 uppercase tracking-wide">
                              TOTAL CUENTA AL {acc.finalDate}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-500 text-[11px] font-semibold">
                              Movimientos Período:
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-ink-950">
                              ${fmt(acc.totalDebe)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-ink-950">
                              ${fmt(acc.totalHaber)}
                            </td>
                            <td
                              className={`px-3 py-2.5 text-right font-mono font-black ${
                                acc.finalBalance < 0 ? "text-rose-700" : "text-ink-950"
                              }`}
                            >
                              ${fmt(acc.finalBalance)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Gran Total Mayor General */}
                <div className="pt-2 text-xs font-black text-slate-900">
                  <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm tracking-wide">
                        = RESUMEN MAYOR GENERAL ({mayorAccounts.length} CUENTAS) =
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Consolidación de débitos, créditos y cuadre contable NIIF
                      </p>
                    </div>

                    <div className="flex items-center gap-4 bg-white/10 rounded-xl px-4 py-2 border border-white/10 flex-wrap">
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-emerald-300 font-bold block">Suma Débitos</span>
                        <span className="font-mono text-sm font-bold text-white">${fmt(totalGeneralDebe)}</span>
                      </div>
                      <div className="w-px h-7 bg-white/20"></div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-blue-300 font-bold block">Suma Créditos</span>
                        <span className="font-mono text-sm font-bold text-white">${fmt(totalGeneralHaber)}</span>
                      </div>
                      <div className="w-px h-7 bg-white/20"></div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-purple-300 font-bold block">Cuadre NIIF</span>
                        <span className="font-mono text-sm font-bold text-white">
                          ${fmt(r2(Math.abs(totalGeneralDebe - totalGeneralHaber)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL F8: CATÁLOGO DEL PLAN DE CUENTAS ── */}
      {showF8Modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  F8
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Plan de Cuentas Contables</h3>
                  <p className="text-[11px] text-ink-500">
                    Seleccione una cuenta de movimiento para el filtro (
                    {f8Target === "cuenta"
                      ? "Cuenta única"
                      : f8Target === "cuentaDesde"
                      ? "Cuenta Desde"
                      : "Cuenta Hasta"}
                    )
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowF8Modal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-ink-900 hover:bg-slate-200/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Buscador */}
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Search size={16} className="text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                autoFocus
                placeholder="Buscar por código (ej: 1.1.02) o nombre de la cuenta..."
                value={f8Search}
                onChange={(e) => setF8Search(e.target.value)}
                className="w-full bg-transparent text-xs text-ink-900 placeholder:text-slate-400 focus:outline-none"
              />
              {f8Search && (
                <button
                  type="button"
                  onClick={() => setF8Search("")}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Limpiar
                </button>
              )}
            </div>

            {/* Lista de Cuentas */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {filteredAccountOptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No se encontraron cuentas con el término ingresado.
                </div>
              ) : (
                filteredAccountOptions.map((acc) => (
                  <button
                    key={acc.code}
                    type="button"
                    onClick={() => selectAccountF8(acc.code)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md group-hover:bg-purple-200 transition-colors shrink-0">
                        {acc.code}
                      </span>
                      <span className="text-xs font-medium text-ink-800 truncate">{acc.name}</span>
                    </div>

                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 ml-2">
                      {acc.type}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>{filteredAccountOptions.length} cuentas disponibles</span>
              <button
                type="button"
                onClick={() => setShowF8Modal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
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

function formatDateDMYLocal(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return dateStr;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
