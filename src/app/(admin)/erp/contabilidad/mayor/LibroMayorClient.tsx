"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
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

      {/* ── REPORTE FORMAL: MAYOR GENERAL CONTABLE (Idéntico a las capturas) ── */}
      {isGenerated && (
        <div className="space-y-4">
          {/* Badge Resumen de Criterios (Pantalla) */}
          <div className="print:hidden bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-purple-950">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">Criterios Activos:</span>
              <span>
                Desde <strong>{desde}</strong> hasta <strong>{hasta}</strong>
              </span>
              <span>•</span>
              <span>
                Cuenta:{" "}
                <strong>
                  {cuenta
                    ? `${cuenta}`
                    : cuentaDesde || cuentaHasta
                    ? `${cuentaDesde || "Inicio"} a ${cuentaHasta || "Fin"}`
                    : "Todas las Cuentas"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Tipo: <strong>{tipo === "todos" ? "Todos los Comprobantes" : tipo}</strong>
              </span>
              <span>•</span>
              <span>
                Total Cuentas: <strong>{mayorAccounts.length}</strong>
              </span>
            </div>

            <div className="text-right text-[11px] text-purple-700 font-mono">
              Débito Total: ${fmt(totalGeneralDebe)} | Crédito Total: ${fmt(totalGeneralHaber)}
            </div>
          </div>

          {/* DOCUMENTO FORMAL DE MAYOR GENERAL (Apto para Impresión o PDF) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm print:p-0 print:border-none print:shadow-none print:rounded-none">
            {/* Encabezado Oficial del Reporte */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4">
              <div className="flex justify-between items-start text-xs font-mono">
                <div>
                  <div className="font-bold text-sm text-slate-900 tracking-wider">
                    {companyName.toUpperCase()}
                  </div>
                  <div className="text-[11px] text-slate-700">
                    Fecha: {new Date().toLocaleDateString("es-EC")}
                  </div>
                  {companyRuc && (
                    <div className="text-[10px] text-slate-500 font-normal">RUC: {companyRuc}</div>
                  )}
                </div>

                <div className="text-center">
                  <h2 className="text-base font-bold text-slate-900 tracking-wider">
                    MAYOR GENERAL CONTABLE
                  </h2>
                  <div className="text-[11px] text-slate-700 font-mono mt-0.5 space-x-4">
                    <span>
                      Desde: {cuentaDesde || cuenta || "1.0.00.00"} &nbsp; Hasta:{" "}
                      {cuentaHasta || cuenta || "9.9.99.99"}
                    </span>
                    <span>
                      Desde: {formatDateDMYLocal(desde)} &nbsp; Hasta: {formatDateDMYLocal(hasta)}
                    </span>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-700">
                  <span>Página: 1 de 1</span>
                </div>
              </div>
            </div>

            {/* Cabecera de Columnas */}
            <div className="border-b border-t border-slate-900 py-1.5 mb-4 text-[11px] font-mono font-bold text-slate-900 grid grid-cols-12 gap-2">
              <div className="col-span-1">FECHA</div>
              <div className="col-span-1">MOD</div>
              <div className="col-span-1">TP</div>
              <div className="col-span-2">ASIENTO</div>
              <div className="col-span-1">REFEREN.</div>
              <div className="col-span-3">CONCEPTO DEL MOVIMIENTO</div>
              <div className="col-span-1 text-right">DEBE</div>
              <div className="col-span-1 text-right">HABER</div>
              <div className="col-span-1 text-right">SALDO</div>
            </div>

            {/* Lista de Cuentas */}
            {mayorAccounts.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500">
                No se encontraron movimientos contables para los filtros seleccionados.
              </div>
            ) : (
              <div className="space-y-6">
                {mayorAccounts.map((acc) => (
                  <div
                    key={acc.code}
                    className="font-mono text-[11px] text-slate-900 border-b border-slate-200 pb-5 break-inside-avoid"
                  >
                    {/* Encabezado de la Cuenta */}
                    <div className="flex items-center gap-4 font-bold text-xs pt-1">
                      <span>CODIGO: {acc.code}</span>
                      <span>NOMBRE: {acc.name}</span>
                      <span className="text-[10px] text-slate-500 font-normal ml-auto">
                        ({acc.nature.toUpperCase()})
                      </span>
                    </div>

                    {/* Fila de Saldo Anterior */}
                    <div className="grid grid-cols-12 gap-2 py-1.5 text-slate-700 font-semibold border-b border-dashed border-slate-300">
                      <div className="col-span-6 flex items-center">
                        <span className="mr-2">Saldo Al {acc.initialBalanceDate}</span>
                        <span className="text-slate-400">----------------------&gt;</span>
                      </div>
                      <div className="col-span-5"></div>
                      <div
                        className={`col-span-1 text-right ${
                          acc.initialBalance < 0 ? "text-rose-700" : ""
                        }`}
                      >
                        {fmt4(acc.initialBalance)}
                      </div>
                    </div>

                    {/* Meses y Movimientos */}
                    {acc.months.length === 0 ? (
                      <div className="py-2 text-slate-400 italic text-[10px]">
                        Sin movimientos en el período seleccionado.
                      </div>
                    ) : (
                      acc.months.map((m) => (
                        <div key={m.monthKey} className="space-y-1 my-1.5">
                          {/* Líneas de Movimiento */}
                          {m.movements.map((mov) => (
                            <div
                              key={mov.id}
                              className="grid grid-cols-12 gap-2 py-0.5 hover:bg-slate-50 items-center text-[10.5px]"
                            >
                              <div className="col-span-1 text-slate-700">{mov.date}</div>
                              <div className="col-span-1 font-semibold">{mov.mod}</div>
                              <div className="col-span-1 text-slate-600">{mov.tp}</div>
                              <div className="col-span-2 font-semibold text-slate-800 truncate" title={mov.asiento}>
                                {mov.asiento}
                              </div>
                              <div className="col-span-1 text-slate-600 truncate" title={mov.referencia}>
                                {mov.referencia || "—"}
                              </div>
                              <div className="col-span-3 text-slate-800 truncate" title={mov.concepto}>
                                {mov.concepto}
                              </div>
                              <div className="col-span-1 text-right font-mono">
                                {mov.debe > 0 ? fmt4(mov.debe) : ""}
                              </div>
                              <div className="col-span-1 text-right font-mono">
                                {mov.haber > 0 ? fmt4(mov.haber) : ""}
                              </div>
                              <div
                                className={`col-span-1 text-right font-mono font-semibold ${
                                  mov.saldo < 0 ? "text-rose-700" : "text-slate-900"
                                }`}
                              >
                                {fmt4(mov.saldo)}
                              </div>
                            </div>
                          ))}

                          {/* Subtotal del Mes (TOTAL MES) */}
                          <div className="grid grid-cols-12 gap-2 py-1 text-slate-800 font-bold border-t border-dotted border-slate-400 mt-1">
                            <div className="col-span-6 flex items-center pl-8">
                              <span className="mr-2">TOTAL MES: {m.monthName}</span>
                              <span className="text-slate-400">-------------&gt;</span>
                            </div>
                            <div className="col-span-3 text-right">
                              {/* Espacio alineado */}
                            </div>
                            <div className="col-span-1 text-right font-mono font-bold">
                              {fmt4(m.totalDebe)}
                            </div>
                            <div className="col-span-1 text-right font-mono font-bold">
                              {fmt4(m.totalHaber)}
                            </div>
                            <div
                              className={`col-span-1 text-right font-mono font-bold ${
                                m.saldoFinalMes < 0 ? "text-rose-700" : ""
                              }`}
                            >
                              {fmt4(m.saldoFinalMes)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Total Final de la Cuenta (TOTAL AL) */}
                    <div className="grid grid-cols-12 gap-2 py-1.5 text-slate-900 font-black border-t-2 border-slate-800 mt-2 bg-slate-50/70">
                      <div className="col-span-6 flex items-center pl-8">
                        <span className="mr-2">TOTAL AL: {acc.finalDate}</span>
                        <span className="text-slate-500">----------------&gt;</span>
                      </div>
                      <div className="col-span-3 text-right"></div>
                      <div className="col-span-1 text-right font-mono">{fmt4(acc.totalDebe)}</div>
                      <div className="col-span-1 text-right font-mono">{fmt4(acc.totalHaber)}</div>
                      <div
                        className={`col-span-1 text-right font-mono ${
                          acc.finalBalance < 0 ? "text-rose-700" : ""
                        }`}
                      >
                        {fmt4(acc.finalBalance)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Gran Total Mayor General */}
                <div className="pt-4 border-t-2 border-slate-900 text-xs font-mono font-black text-slate-900">
                  <div className="grid grid-cols-12 gap-2 items-center py-2 bg-slate-100 px-2 rounded-lg">
                    <div className="col-span-6">
                      = RESUMEN MAYOR GENERAL ({mayorAccounts.length} CUENTAS) =
                    </div>
                    <div className="col-span-3 text-right">SUMAS TOTALES:</div>
                    <div className="col-span-1 text-right font-mono">${fmt(totalGeneralDebe)}</div>
                    <div className="col-span-1 text-right font-mono">${fmt(totalGeneralHaber)}</div>
                    <div className="col-span-1 text-right font-mono">
                      ${fmt(r2(Math.abs(totalGeneralDebe - totalGeneralHaber)))}
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
