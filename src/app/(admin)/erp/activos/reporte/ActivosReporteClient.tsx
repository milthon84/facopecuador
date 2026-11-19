"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Search,
  Filter,
  Layers,
  Calendar,
  DollarSign,
  TrendingDown,
  Landmark,
  Package,
  Eye,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  AssetInput,
  CategoryReportGroup,
  ReportSummaryTotals,
  MONTH_NAMES_SHORT,
  SAMPLE_ATTACHED_ASSETS,
  buildCategoryGroups,
  buildFixedAssetsWorksheet
} from "@/lib/fixed-assets-report";

interface Props {
  dbAssets: AssetInput[];
  defaultYear?: number;
}

export default function ActivosReporteClient({ dbAssets, defaultYear = 2026 }: Props) {
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [dataSource, setDataSource] = useState<"db" | "sample">(
    dbAssets.length > 0 ? "db" : "sample"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isExporting, setIsExporting] = useState(false);

  // Seleccionar fuente de datos
  const currentAssets = useMemo(() => {
    return dataSource === "db" ? dbAssets : SAMPLE_ATTACHED_ASSETS;
  }, [dataSource, dbAssets]);

  // Filtrado
  const filteredAssets = useMemo(() => {
    return currentAssets.filter((a) => {
      const matchSearch =
        searchTerm.trim() === "" ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.code && a.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (a.invoice_number && a.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCategory =
        selectedCategory === "ALL" ||
        a.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchCategory;
    });
  }, [currentAssets, searchTerm, selectedCategory]);

  // Calcular grupos y totales para el año seleccionado
  const { groups, grandTotal } = useMemo(() => {
    return buildCategoryGroups(filteredAssets, selectedYear);
  }, [filteredAssets, selectedYear]);

  // Todas las categorías disponibles para el filtro
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    currentAssets.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return Array.from(set);
  }, [currentAssets]);

  // Exportar a Excel
  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      const wb = XLSX.utils.book_new();

      // Construir la hoja del reporte actual
      const titlePrefix = dataSource === "db" ? "FACOP S.A. - ACTIVOS FIJOS" : "FACOP S.A. - MODELO ADJUNTO";
      const ws = buildFixedAssetsWorksheet(groups, grandTotal, selectedYear, titlePrefix);
      
      const sheetName = `Cédula Activos ${selectedYear}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Si estamos en activos del sistema, agregar también la hoja del modelo de referencia
      if (dataSource === "db") {
        const refCalc = buildCategoryGroups(SAMPLE_ATTACHED_ASSETS, selectedYear);
        const wsRef = buildFixedAssetsWorksheet(refCalc.groups, refCalc.grandTotal, selectedYear, "FACOP S.A. - MODELO ADJUNTO");
        XLSX.utils.book_append_sheet(wb, wsRef, `Modelo Referencia ${selectedYear}`);
      }

      const fileName = `Reporte_Activos_Fijos_${selectedYear}_${dataSource === "db" ? "FACOP" : "Modelo"}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      alert("Hubo un error al generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const shortYear = String(selectedYear).slice(-2);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("es-EC", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="max-w-[1450px] mx-auto pb-16 space-y-6">
      {/* Barra Superior de Navegación y Título */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link
            href="/erp/activos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-lilac-700 hover:text-lilac-900 transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Volver a Activos Fijos
          </Link>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            <FileSpreadsheet className="text-lilac-600" />
            Cédula y Reporte Detallado de Activos Fijos
          </h1>
          <p className="text-sm text-ink-600">
            Control de costo histórico, depreciación mensual, depreciación acumulada y valor en libros.
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <Download size={16} />
            {isExporting ? "Generando..." : "Descargar en Excel (.xlsx)"}
          </button>
          <a
            href="/reportes/Reporte_Detalle_Activos_Fijos.xlsx"
            download="Reporte_Detalle_Activos_Fijos.xlsx"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-ink-700 font-semibold text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 transition-all"
            title="Descargar archivo físico original generado"
          >
            <FileSpreadsheet size={16} className="text-emerald-700" />
            Plantilla Base .xlsx
          </a>
        </div>
      </div>

      {/* Selector de Fuente de Datos (Tabs) */}
      <div className="bg-white p-2 rounded-2xl border border-lilac-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setDataSource("db")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              dataSource === "db"
                ? "bg-white text-lilac-700 shadow-sm"
                : "text-ink-600 hover:text-ink-900"
            }`}
          >
            <Package size={14} />
            Activos FACOP ({dbAssets.length})
          </button>
          <button
            onClick={() => setDataSource("sample")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              dataSource === "sample"
                ? "bg-white text-lilac-700 shadow-sm"
                : "text-ink-600 hover:text-ink-900"
            }`}
          >
            <Eye size={14} />
            Modelo Adjunto de Referencia ({SAMPLE_ATTACHED_ASSETS.length})
          </button>
        </div>

        {/* Selector de Ejercicio Fiscal */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-600 flex items-center gap-1">
            <Calendar size={14} className="text-lilac-600" /> Ejercicio Fiscal:
          </span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-200 text-ink-900 font-bold text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-lilac-500"
          >
            {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                Año {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Costo Histórico Total (1)</div>
            <div className="text-lg font-bold text-ink-900 font-mono">
              ${formatCurrency(grandTotal.total_cost)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Depreciación Año {selectedYear}</div>
            <div className="text-lg font-bold text-purple-900 font-mono">
              ${formatCurrency(grandTotal.total_year_depreciation)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <TrendingDown size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Total Provisión Deprec. (2)</div>
            <div className="text-lg font-bold text-red-700 font-mono">
              ${formatCurrency(grandTotal.total_accumulated)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-lilac-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Landmark size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500 font-medium">Valor Neto en Libros (3)</div>
            <div className="text-lg font-bold text-emerald-800 font-mono">
              ${formatCurrency(grandTotal.total_book_value)}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-3.5 rounded-2xl border border-lilac-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, código o factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 text-ink-900"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-ink-400 shrink-0" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-64 bg-slate-50 border border-slate-200 text-ink-900 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lilac-500 font-medium"
          >
            <option value="ALL">Todas las Categorías</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla Estilizada Idéntica a la Imagen */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cabecera superior institucional */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs bg-indigo-500/20 text-indigo-200 px-2.5 py-1 rounded-md border border-indigo-400/30">
              CUENTA: 1.2.01.02
            </span>
            <span className="text-sm font-semibold tracking-wide">
              FIXED ASSETS DETAIL · CÉDULA DE DEPRECIACIÓN {selectedYear}
            </span>
          </div>
          <div className="text-xs text-indigo-200">
            Fórmula: <span className="font-mono font-bold text-white">(3) = (1) - (2)</span>
          </div>
        </div>

        {/* Contenedor con scroll horizontal */}
        <div className="overflow-x-auto max-h-[750px] overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            {/* Header Nivel 1 */}
            <thead className="sticky top-0 z-20 bg-[#1e40af] text-white select-none">
              <tr className="border-b border-blue-900/40">
                <th className="px-3 py-2.5 text-left font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[100px]">
                  FECHA REG.
                </th>
                <th className="px-3 py-2.5 text-left font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[280px]">
                  DESCRIPCIÓN
                </th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[120px]">
                  (1) COSTO HISTÓRICO
                </th>
                <th className="px-2 py-2.5 text-center font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[80px]">
                  DEP %
                </th>
                <th
                  colSpan={12}
                  className="px-3 py-1.5 text-center font-bold border-r border-blue-600/40 tracking-wider bg-[#1d4ed8]"
                >
                  DEPRECIACIÓN MENSUAL {selectedYear}
                </th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[110px]">
                  DEP. ACUM. 31/12/{shortYear}
                </th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-blue-600/40 whitespace-nowrap min-w-[120px] bg-[#1e3a8a]">
                  (3) VALOR EN LIBROS
                </th>
                <th className="px-3 py-2.5 text-right font-bold whitespace-nowrap min-w-[130px] bg-[#172554]">
                  (2) TOTAL PROVISIÓN
                </th>
              </tr>
              {/* Header Nivel 2: Meses individuales */}
              <tr className="bg-[#2563eb] text-[11px] text-blue-100 border-b border-blue-800">
                <th colSpan={4} className="border-r border-blue-500/40"></th>
                {MONTH_NAMES_SHORT.map((m) => (
                  <th
                    key={m}
                    className="px-2 py-1 text-center font-semibold border-r border-blue-500/30 min-w-[65px]"
                  >
                    {m}.-{shortYear}
                  </th>
                ))}
                <th className="border-r border-blue-500/40"></th>
                <th className="px-2 py-1 text-center text-[10px] text-blue-200 border-r border-blue-500/40">
                  (1) - (2)
                </th>
                <th className="px-2 py-1 text-center text-[10px] text-blue-200">SUMATORIA</th>
              </tr>
            </thead>

            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-ink-400">
                    No se encontraron activos para los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tbody key={group.category} className="border-b-2 border-slate-300">
                    {/* Fila Encabezado de la Categoría */}
                    <tr className="bg-slate-100 text-slate-800 font-bold border-t border-b border-slate-300">
                      <td colSpan={19} className="px-4 py-2 text-xs uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14} className="text-lilac-600" />
                        {group.category}
                        <span className="text-[11px] font-normal text-slate-500">
                          ({group.items.length} activos)
                        </span>
                      </td>
                    </tr>

                    {/* Filas de Activos */}
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50/30 transition-colors border-b border-slate-200/70 text-slate-800"
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap text-slate-600 border-r border-slate-200">
                          {item.formatted_date}
                        </td>
                        <td className="px-3 py-2 border-r border-slate-200 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.code && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 shrink-0">
                                {item.code}
                              </span>
                            )}
                            <span className="text-ink-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold border-r border-slate-200">
                          ${formatCurrency(item.purchase_value)}
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-slate-600 border-r border-slate-200">
                          {item.rate_pct}%
                        </td>

                        {/* 12 Meses */}
                        {item.monthly_values.map((val, mIdx) => (
                          <td
                            key={mIdx}
                            className={`px-2 py-2 text-right font-mono border-r border-slate-100 ${
                              val > 0 ? "text-slate-900" : "text-slate-300"
                            }`}
                          >
                            {val > 0 ? formatCurrency(val) : "-"}
                          </td>
                        ))}

                        {/* Depreciación del Año */}
                        <td className="px-3 py-2 text-right font-mono font-semibold text-purple-950 border-r border-slate-200 bg-purple-50/20">
                          ${formatCurrency(item.year_depreciation)}
                        </td>

                        {/* Valor en Libros */}
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold border-r border-slate-200 ${
                            item.book_value <= 0
                              ? "text-red-500 bg-red-50/20"
                              : "text-emerald-800 bg-emerald-50/20"
                          }`}
                        >
                          ${formatCurrency(item.book_value)}
                        </td>

                        {/* Total Provisión Depreciación */}
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 bg-slate-50">
                          ${formatCurrency(item.total_accumulated)}
                        </td>
                      </tr>
                    ))}

                    {/* Fila Subtotal Categoría (Amarillo suave característico de la imagen) */}
                    <tr className="bg-[#fffbeb] text-amber-950 font-bold border-t-2 border-b-2 border-amber-300/80">
                      <td className="px-3 py-2.5 border-r border-amber-200"></td>
                      <td className="px-3 py-2.5 uppercase tracking-wide border-r border-amber-200 font-extrabold text-amber-900">
                        SUBTOTAL {group.category}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold border-r border-amber-200 text-amber-950">
                        ${formatCurrency(group.total_cost)}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono border-r border-amber-200 text-amber-700">
                        -
                      </td>

                      {/* Subtotales mensuales */}
                      {group.monthly_totals.map((mVal, mIdx) => (
                        <td
                          key={mIdx}
                          className="px-2 py-2.5 text-right font-mono border-r border-amber-200/80 text-amber-950"
                        >
                          {mVal > 0 ? formatCurrency(mVal) : "-"}
                        </td>
                      ))}

                      {/* Subtotal Deprec Año */}
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold border-r border-amber-200 text-amber-950 bg-amber-100/50">
                        ${formatCurrency(group.total_year_depreciation)}
                      </td>

                      {/* Subtotal Valor en Libros */}
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold border-r border-amber-200 text-amber-950 bg-amber-100/70">
                        ${formatCurrency(group.total_book_value)}
                      </td>

                      {/* Subtotal Provisión Deprec */}
                      <td className="px-3 py-2.5 text-right font-mono font-extrabold text-amber-950 bg-[#fef3c7]">
                        ${formatCurrency(group.total_accumulated)}
                      </td>
                    </tr>
                  </tbody>
                ))
              )}
            </tbody>

            {/* Fila Gran Total General */}
            <tfoot className="sticky bottom-0 z-10 bg-slate-900 text-white font-extrabold text-xs">
              <tr className="border-t-2 border-slate-700">
                <td className="px-3 py-3 border-r border-slate-800"></td>
                <td className="px-3 py-3 uppercase tracking-wider text-amber-300 border-r border-slate-800">
                  TOTAL GENERAL ACTIVOS FIJOS
                </td>
                <td className="px-3 py-3 text-right font-mono text-emerald-400 border-r border-slate-800">
                  ${formatCurrency(grandTotal.total_cost)}
                </td>
                <td className="px-2 py-3 text-center border-r border-slate-800 text-slate-400">
                  -
                </td>

                {/* Totales 12 meses */}
                {grandTotal.monthly_totals.map((mVal, mIdx) => (
                  <td
                    key={mIdx}
                    className="px-2 py-3 text-right font-mono border-r border-slate-800 text-slate-200"
                  >
                    {mVal > 0 ? formatCurrency(mVal) : "-"}
                  </td>
                ))}

                {/* Gran Total Deprec Año */}
                <td className="px-3 py-3 text-right font-mono text-purple-300 border-r border-slate-800">
                  ${formatCurrency(grandTotal.total_year_depreciation)}
                </td>

                {/* Gran Total Valor en Libros */}
                <td className="px-3 py-3 text-right font-mono text-emerald-300 border-r border-slate-800">
                  ${formatCurrency(grandTotal.total_book_value)}
                </td>

                {/* Gran Total Provisión Depreciación */}
                <td className="px-3 py-3 text-right font-mono text-amber-400">
                  ${formatCurrency(grandTotal.total_accumulated)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Explicación Técnica y Contable */}
      <div className="bg-lilac-50/60 rounded-2xl p-4 border border-lilac-200 text-xs text-ink-700 flex items-start gap-3">
        <Info size={18} className="text-lilac-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-ink-900">
            Reglas de Cálculo Contable (Normativa SRI / NIIF para Pymes):
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-ink-600">
            <li>
              <span className="font-medium text-ink-800">Depreciación Mensual:</span> Calculada en línea recta sobre la base depreciable (Costo Histórico menos Valor Residual) dividida para los meses totales de vida útil.
            </li>
            <li>
              <span className="font-medium text-ink-800">Inicio de Depreciación:</span> Si la compra se realizó en la primera quincena (día ≤ 15), computa el mes completo; si fue en la segunda quincena, inicia el cómputo en el mes inmediato posterior.
            </li>
            <li>
              <span className="font-medium text-ink-800">Valor en Libros:</span> Resulta de la resta matemática directa: (1) Costo Histórico menos (2) Sumatoria de Depreciaciones Acumuladas a la fecha de corte.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
