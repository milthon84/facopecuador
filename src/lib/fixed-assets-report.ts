import * as XLSX from "xlsx";

export interface AssetInput {
  id: string;
  code?: string | null;
  name: string;
  category: string;
  description?: string | null;
  purchase_date: string; // YYYY-MM-DD
  purchase_value: number;
  salvage_value?: number;
  useful_life_years: number;
  supplier_name?: string | null;
  invoice_number?: string | null;
  status?: string;
}

export interface AssetReportRow {
  id: string;
  code?: string | null;
  name: string;
  category: string;
  purchase_date: string;
  formatted_date: string;
  invoice_number?: string | null;
  purchase_value: number;
  rate_pct: number;
  monthly_values: number[]; // 12 months (0 to 11 for Jan to Dec)
  year_depreciation: number;
  book_value: number;
  total_accumulated: number;
}

export interface CategoryReportGroup {
  category: string;
  items: AssetReportRow[];
  total_cost: number;
  monthly_totals: number[];
  total_year_depreciation: number;
  total_book_value: number;
  total_accumulated: number;
}

export interface ReportSummaryTotals {
  total_cost: number;
  monthly_totals: number[];
  total_year_depreciation: number;
  total_book_value: number;
  total_accumulated: number;
}

export const MONTH_NAMES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateAssetReportRow(asset: AssetInput, targetYear: number): AssetReportRow {
  const parts = (asset.purchase_date || "2026-01-01").split("-");
  const pYear = parseInt(parts[0], 10) || targetYear;
  const pMonth = parseInt(parts[1], 10) || 1;
  const pDay = parseInt(parts[2], 10) || 1;

  let startYear = pYear;
  let startMonth = pDay <= 15 ? pMonth : pMonth + 1;
  if (startMonth > 12) {
    startMonth = 1;
    startYear += 1;
  }

  const usefulYears = asset.useful_life_years > 0 ? asset.useful_life_years : 10;
  const totalMonths = usefulYears * 12;
  const salvage = Number(asset.salvage_value || 0);
  const cost = Number(asset.purchase_value || 0);
  const depreciableBase = Math.max(0, cost - salvage);
  const rawMonthlyDep = depreciableBase / totalMonths;
  const ratePct = r2(100 / usefulYears);

  const monthlyValues: number[] = [];
  let activeMonthsInTargetYear = 0;

  for (let m = 1; m <= 12; m++) {
    const elapsed = (targetYear - startYear) * 12 + (m - startMonth);
    if (elapsed < 0 || elapsed >= totalMonths) {
      monthlyValues.push(0);
    } else {
      activeMonthsInTargetYear++;
      monthlyValues.push(r2(rawMonthlyDep));
    }
  }

  // Depreciación del ejercicio fiscal (año targetYear)
  const yearDepreciation = r2(activeMonthsInTargetYear * rawMonthlyDep);

  // Provisión total acumulada al 31 de diciembre del año targetYear
  const totalElapsed = (targetYear - startYear) * 12 + (12 - startMonth) + 1;
  const effectiveMonths = Math.max(0, Math.min(totalElapsed, totalMonths));
  const totalAccumulated = r2(Math.min(depreciableBase, effectiveMonths * rawMonthlyDep));

  // Valor neto en libros: (1) Costo Histórico - (2) Total Provisión Depreciación
  const bookValue = r2(Math.max(salvage, cost - totalAccumulated));

  // Formato de fecha legible (ej. 31-ago.-24)
  const shortYear = String(pYear).slice(-2);
  const monthName = MONTH_NAMES_SHORT[pMonth - 1] || "ene";
  const formattedDate = `${String(pDay).padStart(2, "0")}-${monthName}.-${shortYear}`;

  return {
    id: asset.id,
    code: asset.code,
    name: asset.name,
    category: asset.category || "Otros equipos y maquinaria",
    purchase_date: asset.purchase_date,
    formatted_date: formattedDate,
    invoice_number: asset.invoice_number,
    purchase_value: cost,
    rate_pct: ratePct,
    monthly_values: monthlyValues,
    year_depreciation: yearDepreciation,
    book_value: bookValue,
    total_accumulated: totalAccumulated,
  };
}

export function buildCategoryGroups(
  assets: AssetInput[],
  targetYear: number
): { groups: CategoryReportGroup[]; grandTotal: ReportSummaryTotals } {
  const categoryMap = new Map<string, AssetReportRow[]>();

  for (const asset of assets) {
    const row = calculateAssetReportRow(asset, targetYear);
    const cat = row.category || "Otros equipos y maquinaria";
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat)!.push(row);
  }

  // Orden preferencial de categorías comunes
  const preferredOrder = [
    "Maquinarias y Equipos",
    "Instalaciones, maquinarias, equipos y muebles",
    "Equipos Médicos y Odontológicos",
    "Equipos de computación",
    "Equipos de cómputo y software",
    "Vehículos",
    "Vehículos, equipos de transporte y equipo caminero móvil",
    "Muebles y enseres",
    "Equipo de oficina",
    "Mobiliario y Enseres",
    "Inmuebles",
    "Otros equipos y maquinaria",
  ];

  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => {
    const idxA = preferredOrder.findIndex((p) => p.toLowerCase() === a.toLowerCase());
    const idxB = preferredOrder.findIndex((p) => p.toLowerCase() === b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const groups: CategoryReportGroup[] = [];
  const grandTotal: ReportSummaryTotals = {
    total_cost: 0,
    monthly_totals: Array(12).fill(0),
    total_year_depreciation: 0,
    total_book_value: 0,
    total_accumulated: 0,
  };

  for (const cat of sortedCategories) {
    const items = categoryMap.get(cat)!;
    let total_cost = 0;
    const monthly_totals = Array(12).fill(0);
    let total_year_depreciation = 0;
    let total_book_value = 0;
    let total_accumulated = 0;

    for (const item of items) {
      total_cost = r2(total_cost + item.purchase_value);
      for (let m = 0; m < 12; m++) {
        monthly_totals[m] = r2(monthly_totals[m] + item.monthly_values[m]);
      }
      total_year_depreciation = r2(total_year_depreciation + item.year_depreciation);
      total_book_value = r2(total_book_value + item.book_value);
      total_accumulated = r2(total_accumulated + item.total_accumulated);
    }

    groups.push({
      category: cat,
      items,
      total_cost,
      monthly_totals,
      total_year_depreciation,
      total_book_value,
      total_accumulated,
    });

    grandTotal.total_cost = r2(grandTotal.total_cost + total_cost);
    for (let m = 0; m < 12; m++) {
      grandTotal.monthly_totals[m] = r2(grandTotal.monthly_totals[m] + monthly_totals[m]);
    }
    grandTotal.total_year_depreciation = r2(grandTotal.total_year_depreciation + total_year_depreciation);
    grandTotal.total_book_value = r2(grandTotal.total_book_value + total_book_value);
    grandTotal.total_accumulated = r2(grandTotal.total_accumulated + total_accumulated);
  }

  return { groups, grandTotal };
}

/**
 * Datos extraídos fielmente de la plantilla adjunta por el usuario
 */
export const SAMPLE_ATTACHED_ASSETS: AssetInput[] = [
  // MAQUINARIAS Y EQUIPOS
  {
    id: "sample-maq-1",
    name: "REBOBINADORA DE FLEXO",
    category: "Maquinarias y Equipos",
    purchase_date: "2024-08-31",
    purchase_value: 6234.40,
    useful_life_years: 10,
    code: "MAQ-001",
  },
  {
    id: "sample-maq-2",
    name: "CARRO VIRADOR",
    category: "Maquinarias y Equipos",
    purchase_date: "2024-08-31",
    purchase_value: 8821.42,
    useful_life_years: 10,
    code: "MAQ-002",
  },
  {
    id: "sample-maq-3",
    name: "CORTADORA DE ROLLOS",
    category: "Maquinarias y Equipos",
    purchase_date: "2025-09-01",
    purchase_value: 739.13,
    useful_life_years: 10,
    code: "MAQ-003",
  },
  {
    id: "sample-maq-4",
    name: "MAQUINARIA INDUSTRIAL ADICIONAL",
    category: "Maquinarias y Equipos",
    purchase_date: "2020-01-15",
    purchase_value: 142673.62,
    useful_life_years: 10,
    code: "MAQ-004",
  },

  // EQUIPOS DE COMPUTACIÓN
  {
    id: "sample-com-1",
    name: "CPU CARTERA (DANNY ALVARADO)",
    category: "Equipos de Computación",
    purchase_date: "2023-05-03",
    purchase_value: 522.10,
    useful_life_years: 3,
    code: "COM-001",
  },
  {
    id: "sample-com-2",
    name: "MONITOR LG 27 PRESIDENCIA",
    category: "Equipos de Computación",
    purchase_date: "2023-12-05",
    purchase_value: 414.40,
    useful_life_years: 3,
    code: "COM-002",
  },
  {
    id: "sample-com-3",
    name: "LED LATITUDE 3450 I7 DIRECCIÓN DE LOGÍSTICA",
    category: "Equipos de Computación",
    purchase_date: "2024-02-15",
    purchase_value: 964.50,
    useful_life_years: 3,
    code: "COM-003",
  },
  {
    id: "sample-com-4",
    name: "IMPRESORA LOGÍSTICA",
    category: "Equipos de Computación",
    purchase_date: "2024-08-31",
    purchase_value: 51.01,
    useful_life_years: 3,
    code: "COM-004",
  },
  {
    id: "sample-com-5",
    name: "EQUIPOS DE CÓMPUTO SERVIDORES Y TERMINALES",
    category: "Equipos de Computación",
    purchase_date: "2021-06-01",
    purchase_value: 16709.86,
    useful_life_years: 3,
    code: "COM-005",
  },

  // VEHÍCULOS
  {
    id: "sample-veh-1",
    name: "REPARACIÓN MAYOR CAMIÓN GUAYAQUIL (CAPITALIZABLE)",
    category: "Vehículos",
    purchase_date: "2016-06-01",
    purchase_value: 3451.00,
    useful_life_years: 5,
    code: "VEH-001",
  },
  {
    id: "sample-veh-2",
    name: "CAMIÓN GUAYAQUIL",
    category: "Vehículos",
    purchase_date: "2009-07-24",
    purchase_value: 22807.80,
    useful_life_years: 5,
    code: "VEH-002",
  },
  {
    id: "sample-veh-3",
    name: "CAMIONETA FIAT",
    category: "Vehículos",
    purchase_date: "2009-01-07",
    purchase_value: 11441.52,
    useful_life_years: 5,
    code: "VEH-003",
  },
  {
    id: "sample-veh-4",
    name: "CAMIÓN MOTRANSA",
    category: "Vehículos",
    purchase_date: "2024-08-02",
    purchase_value: 26443.48,
    useful_life_years: 5,
    code: "VEH-004",
  },
  {
    id: "sample-veh-5",
    name: "REPARACIÓN CAMIÓN GUAYAQUIL",
    category: "Vehículos",
    purchase_date: "2016-06-01",
    purchase_value: 3570.68,
    useful_life_years: 5,
    code: "VEH-005",
  },

  // EQUIPO DE OFICINA
  {
    id: "sample-ofi-1",
    name: "MOBILIARIO Y ESCRITORIOS GERENCIA",
    category: "Equipo de Oficina",
    purchase_date: "2023-01-15",
    purchase_value: 14500.00,
    useful_life_years: 10,
    code: "MUE-001",
  },
  {
    id: "sample-ofi-2",
    name: "SILLAS ERGONÓMICAS Y ARCHIVADORES",
    category: "Equipo de Oficina",
    purchase_date: "2024-03-10",
    purchase_value: 4230.00,
    useful_life_years: 10,
    code: "MUE-002",
  },
];

/**
 * Construye la hoja de cálculo XLSX idéntica al reporte adjunto
 */
export function buildFixedAssetsWorksheet(
  groups: CategoryReportGroup[],
  grandTotal: ReportSummaryTotals,
  targetYear: number,
  companyName: string = "FACOP S.A."
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const shortYear = String(targetYear).slice(-2);

  // Dimensiones
  let r = 0; // 0-indexed row

  // Fila 1: Título de la empresa / sistema
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: companyName, t: "s" };
  r++;

  // Fila 2: Subtítulo
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: `CÉDULA DE DEPRECIACIÓN Y CONTROL DE ACTIVOS FIJOS - EJERCICIO FISCAL ${targetYear}`, t: "s" };
  r++;

  // Fila 3: Espacio
  r++;

  // Fila 4: Encabezado superior estilo imagen (FIXED ASSETS DETAIL, COMPRA, 1.2.01.02, etc.)
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: "FIXED ASSETS DETAIL", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 4 })] = { v: "COMPRA", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 5 })] = { v: "1.2.01.02", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 7 })] = { v: grandTotal.total_cost, t: "n", z: "#,##0.00" };
  r++;

  // Fila 5: Índices / Fórmulas de columnas
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { v: "(1)", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 15 })] = { v: "(3) = (1) - (2)", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 16 })] = { v: "(2)", t: "s" };
  r++;

  // Fila 6: Encabezados de Columna (Bloque Principal)
  const headerRow1 = r;
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: "FECHA DE REGISTRO", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { v: "DESCRIPCIÓN", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { v: "COSTO HISTÓRICO", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { v: "DEPRECIACIÓN %", t: "s" };

  // Fusión de "DEPRECIACION MENSUAL" a través de los 12 meses
  ws[XLSX.utils.encode_cell({ r, c: 4 })] = { v: `DEPRECIACIÓN MENSUAL ${targetYear}`, t: "s" };

  ws[XLSX.utils.encode_cell({ r, c: 16 })] = { v: `DEPREC. ACUM. 31/12/${shortYear}`, t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 17 })] = { v: "VALOR EN LIBROS", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 18 })] = { v: "TOTAL PROVISIÓN DEPRECIACIÓN", t: "s" };
  r++;

  // Fila 7: Subencabezados de los meses y notas
  for (let m = 0; m < 12; m++) {
    const colIdx = 4 + m;
    ws[XLSX.utils.encode_cell({ r, c: colIdx })] = { v: `${MONTH_NAMES_SHORT[m]}.-${shortYear}`, t: "s" };
  }
  ws[XLSX.utils.encode_cell({ r, c: 17 })] = { v: "COSTO - SUMA DEPREC.", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 18 })] = { v: "SUMATORIA DEPRECIACIONES", t: "s" };
  r++;

  const subtotalRowIndices: number[] = [];

  // Recorrer Grupos
  for (const group of groups) {
    const groupStartRow = r + 1; // 1-indexed for formulas

    for (const item of group.items) {
      const curRow = r;
      ws[XLSX.utils.encode_cell({ r: curRow, c: 0 })] = { v: item.formatted_date, t: "s" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 1 })] = { v: item.name, t: "s" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 2 })] = { v: item.purchase_value, t: "n", z: "#,##0.00" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 3 })] = { v: item.rate_pct / 100, t: "n", z: "0%" };

      // 12 meses
      for (let m = 0; m < 12; m++) {
        ws[XLSX.utils.encode_cell({ r: curRow, c: 4 + m })] = {
          v: item.monthly_values[m],
          t: "n",
          z: "#,##0.00",
        };
      }

      // Deprec del año
      ws[XLSX.utils.encode_cell({ r: curRow, c: 16 })] = {
        v: item.year_depreciation,
        t: "n",
        z: "#,##0.00",
      };

      // Valor en Libros
      ws[XLSX.utils.encode_cell({ r: curRow, c: 17 })] = {
        v: item.book_value,
        t: "n",
        z: "#,##0.00",
      };

      // Total Provisión Depreciación Acumulada
      ws[XLSX.utils.encode_cell({ r: curRow, c: 18 })] = {
        v: item.total_accumulated,
        t: "n",
        z: "#,##0.00",
      };

      r++;
    }

    const groupEndRow = r; // 1-indexed

    // Fila de Subtotal de la Categoría (Estilo Fondo Amarillo en la imagen)
    const subtotalRow = r;
    subtotalRowIndices.push(subtotalRow);

    ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 1 })] = { v: group.category.toUpperCase(), t: "s" };

    // Fórmulas o valores de subtotal
    if (groupEndRow >= groupStartRow) {
      ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 2 })] = {
        f: `SUM(C${groupStartRow}:C${groupEndRow})`,
        v: group.total_cost,
        t: "n",
        z: "#,##0.00",
      };
      for (let m = 0; m < 12; m++) {
        const colLetter = XLSX.utils.encode_col(4 + m);
        ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 4 + m })] = {
          f: `SUM(${colLetter}${groupStartRow}:${colLetter}${groupEndRow})`,
          v: group.monthly_totals[m],
          t: "n",
          z: "#,##0.00",
        };
      }
      ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 16 })] = {
        f: `SUM(Q${groupStartRow}:Q${groupEndRow})`,
        v: group.total_year_depreciation,
        t: "n",
        z: "#,##0.00",
      };
      ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 17 })] = {
        f: `SUM(R${groupStartRow}:R${groupEndRow})`,
        v: group.total_book_value,
        t: "n",
        z: "#,##0.00",
      };
      ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 18 })] = {
        f: `SUM(S${groupStartRow}:S${groupEndRow})`,
        v: group.total_accumulated,
        t: "n",
        z: "#,##0.00",
      };
    }

    r++;
    // Línea separadora en blanco
    r++;
  }

  // Fila de Gran Total
  const totalRow = r;
  ws[XLSX.utils.encode_cell({ r: totalRow, c: 1 })] = { v: "TOTAL GENERAL ACTIVOS FIJOS", t: "s" };

  if (subtotalRowIndices.length > 0) {
    const costCells = subtotalRowIndices.map((idx) => `C${idx + 1}`).join("+");
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 2 })] = {
      f: costCells,
      v: grandTotal.total_cost,
      t: "n",
      z: "#,##0.00",
    };

    for (let m = 0; m < 12; m++) {
      const colLetter = XLSX.utils.encode_col(4 + m);
      const monthCells = subtotalRowIndices.map((idx) => `${colLetter}${idx + 1}`).join("+");
      ws[XLSX.utils.encode_cell({ r: totalRow, c: 4 + m })] = {
        f: monthCells,
        v: grandTotal.monthly_totals[m],
        t: "n",
        z: "#,##0.00",
      };
    }

    const yearDepCells = subtotalRowIndices.map((idx) => `Q${idx + 1}`).join("+");
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 16 })] = {
      f: yearDepCells,
      v: grandTotal.total_year_depreciation,
      t: "n",
      z: "#,##0.00",
    };

    const bvCells = subtotalRowIndices.map((idx) => `R${idx + 1}`).join("+");
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 17 })] = {
      f: bvCells,
      v: grandTotal.total_book_value,
      t: "n",
      z: "#,##0.00",
    };

    const accumCells = subtotalRowIndices.map((idx) => `S${idx + 1}`).join("+");
    ws[XLSX.utils.encode_cell({ r: totalRow, c: 18 })] = {
      f: accumCells,
      v: grandTotal.total_accumulated,
      t: "n",
      z: "#,##0.00",
    };
  }

  // Establecer límites de la hoja
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRow + 2, c: 19 } });

  // Configuración de anchos de columna para visualización óptima
  ws["!cols"] = [
    { wch: 14 }, // Fecha
    { wch: 38 }, // Descripción
    { wch: 16 }, // Costo
    { wch: 14 }, // Deprec %
    { wch: 11 }, // Ene
    { wch: 11 }, // Feb
    { wch: 11 }, // Mar
    { wch: 11 }, // Abr
    { wch: 11 }, // May
    { wch: 11 }, // Jun
    { wch: 11 }, // Jul
    { wch: 11 }, // Ago
    { wch: 11 }, // Sep
    { wch: 11 }, // Oct
    { wch: 11 }, // Nov
    { wch: 11 }, // Dic
    { wch: 16 }, // Deprec Acum Año
    { wch: 16 }, // Valor en Libros
    { wch: 18 }, // Total Provisión Deprec
  ];

  // Fusiones de celdas (merges)
  ws["!merges"] = [
    { s: { r: headerRow1, c: 4 }, e: { r: headerRow1, c: 15 } }, // DEPRECIACIÓN MENSUAL fusionada en 12 columnas
  ];

  return ws;
}
