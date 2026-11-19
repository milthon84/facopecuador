const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Cargar .env.local
let envVars = {};
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
  }
} catch (e) {
  console.log('No se pudo leer .env.local:', e.message);
}

const MONTH_NAMES_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic"
];

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateAssetReportRow(asset, targetYear) {
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

  const monthlyValues = [];
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

  const yearDepreciation = r2(activeMonthsInTargetYear * rawMonthlyDep);

  const totalElapsed = (targetYear - startYear) * 12 + (12 - startMonth) + 1;
  const effectiveMonths = Math.max(0, Math.min(totalElapsed, totalMonths));
  const totalAccumulated = r2(Math.min(depreciableBase, effectiveMonths * rawMonthlyDep));
  const bookValue = r2(Math.max(salvage, cost - totalAccumulated));

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

function buildCategoryGroups(assets, targetYear) {
  const categoryMap = new Map();

  for (const asset of assets) {
    const row = calculateAssetReportRow(asset, targetYear);
    const cat = row.category || "Otros equipos y maquinaria";
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, []);
    }
    categoryMap.get(cat).push(row);
  }

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

  const groups = [];
  const grandTotal = {
    total_cost: 0,
    monthly_totals: Array(12).fill(0),
    total_year_depreciation: 0,
    total_book_value: 0,
    total_accumulated: 0,
  };

  for (const cat of sortedCategories) {
    const items = categoryMap.get(cat);
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

function buildWorksheet(groups, grandTotal, targetYear, companyName = "FACOP S.A.") {
  const ws = {};
  const shortYear = String(targetYear).slice(-2);
  let r = 0;

  // Fila 1: Título Empresa
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: companyName, t: "s" };
  r++;

  // Fila 2: Subtítulo
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: `CÉDULA DE CONTROL Y DEPRECIACIÓN DE ACTIVOS FIJOS - EJERCICIO ${targetYear}`, t: "s" };
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
  ws[XLSX.utils.encode_cell({ r, c: 17 })] = { v: "(3) = (1) - (2)", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 18 })] = { v: "(2)", t: "s" };
  r++;

  // Fila 6: Encabezados de Columna
  const headerRow1 = r;
  ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: "FECHA DE REGISTRO", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 1 })] = { v: "DESCRIPCIÓN", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 2 })] = { v: "COSTO HISTÓRICO", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 3 })] = { v: "DEPRECIACIÓN %", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 4 })] = { v: `DEPRECIACIÓN MENSUAL ${targetYear}`, t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 16 })] = { v: `DEPREC. ACUM. 31/12/${shortYear}`, t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 17 })] = { v: "VALOR EN LIBROS", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 18 })] = { v: "TOTAL PROVISIÓN DEPRECIACIÓN", t: "s" };
  r++;

  // Fila 7: Subencabezados
  for (let m = 0; m < 12; m++) {
    ws[XLSX.utils.encode_cell({ r, c: 4 + m })] = { v: `${MONTH_NAMES_SHORT[m]}.-${shortYear}`, t: "s" };
  }
  ws[XLSX.utils.encode_cell({ r, c: 17 })] = { v: "COSTO - SUMA DEPREC.", t: "s" };
  ws[XLSX.utils.encode_cell({ r, c: 18 })] = { v: "SUMATORIA DEPRECIACIONES", t: "s" };
  r++;

  const subtotalRowIndices = [];

  for (const group of groups) {
    const groupStartRow = r + 1; // 1-indexed

    for (const item of group.items) {
      const curRow = r;
      ws[XLSX.utils.encode_cell({ r: curRow, c: 0 })] = { v: item.formatted_date, t: "s" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 1 })] = { v: item.name, t: "s" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 2 })] = { v: item.purchase_value, t: "n", z: "#,##0.00" };
      ws[XLSX.utils.encode_cell({ r: curRow, c: 3 })] = { v: item.rate_pct / 100, t: "n", z: "0%" };

      for (let m = 0; m < 12; m++) {
        ws[XLSX.utils.encode_cell({ r: curRow, c: 4 + m })] = {
          v: item.monthly_values[m],
          t: "n",
          z: "#,##0.00",
        };
      }

      ws[XLSX.utils.encode_cell({ r: curRow, c: 16 })] = {
        v: item.year_depreciation,
        t: "n",
        z: "#,##0.00",
      };

      ws[XLSX.utils.encode_cell({ r: curRow, c: 17 })] = {
        v: item.book_value,
        t: "n",
        z: "#,##0.00",
      };

      ws[XLSX.utils.encode_cell({ r: curRow, c: 18 })] = {
        v: item.total_accumulated,
        t: "n",
        z: "#,##0.00",
      };

      r++;
    }

    const groupEndRow = r;
    const subtotalRow = r;
    subtotalRowIndices.push(subtotalRow);

    ws[XLSX.utils.encode_cell({ r: subtotalRow, c: 1 })] = { v: group.category.toUpperCase(), t: "s" };

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
    r++; // Espacio
  }

  // Fila Total General
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

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRow + 2, c: 19 } });

  ws["!cols"] = [
    { wch: 14 },
    { wch: 38 },
    { wch: 16 },
    { wch: 14 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];

  ws["!merges"] = [
    { s: { r: headerRow1, c: 4 }, e: { r: headerRow1, c: 15 } },
  ];

  return ws;
}

const SAMPLE_ATTACHED_ASSETS = [
  { id: "1", name: "REBOBINADORA DE FLEXO", category: "Maquinarias y Equipos", purchase_date: "2024-08-31", purchase_value: 6234.40, useful_life_years: 10 },
  { id: "2", name: "CARRO VIRADOR", category: "Maquinarias y Equipos", purchase_date: "2024-08-31", purchase_value: 8821.42, useful_life_years: 10 },
  { id: "3", name: "CORTADORA DE ROLLOS", category: "Maquinarias y Equipos", purchase_date: "2025-09-01", purchase_value: 739.13, useful_life_years: 10 },
  { id: "4", name: "MAQUINARIA INDUSTRIAL ADICIONAL", category: "Maquinarias y Equipos", purchase_date: "2020-01-15", purchase_value: 142673.62, useful_life_years: 10 },

  { id: "5", name: "CPU CARTERA (DANNY ALVARADO)", category: "Equipos de Computación", purchase_date: "2023-05-03", purchase_value: 522.10, useful_life_years: 3 },
  { id: "6", name: "MONITOR LG 27 PRESIDENCIA", category: "Equipos de Computación", purchase_date: "2023-12-05", purchase_value: 414.40, useful_life_years: 3 },
  { id: "7", name: "LED LATITUDE 3450 I7 DIRECCIÓN DE LOGÍSTICA", category: "Equipos de Computación", purchase_date: "2024-02-15", purchase_value: 964.50, useful_life_years: 3 },
  { id: "8", name: "IMPRESORA LOGÍSTICA", category: "Equipos de Computación", purchase_date: "2024-08-31", purchase_value: 51.01, useful_life_years: 3 },
  { id: "9", name: "EQUIPOS DE CÓMPUTO SERVIDORES Y TERMINALES", category: "Equipos de Computación", purchase_date: "2021-06-01", purchase_value: 16709.86, useful_life_years: 3 },

  { id: "10", name: "REPARACIÓN MAYOR CAMIÓN GUAYAQUIL", category: "Vehículos", purchase_date: "2016-06-01", purchase_value: 3451.00, useful_life_years: 5 },
  { id: "11", name: "CAMIÓN GUAYAQUIL", category: "Vehículos", purchase_date: "2009-07-24", purchase_value: 22807.80, useful_life_years: 5 },
  { id: "12", name: "CAMIONETA FIAT", category: "Vehículos", purchase_date: "2009-01-07", purchase_value: 11441.52, useful_life_years: 5 },
  { id: "13", name: "CAMIÓN MOTRANSA", category: "Vehículos", purchase_date: "2024-08-02", purchase_value: 26443.48, useful_life_years: 5 },
  { id: "14", name: "REPARACIÓN CAMIÓN GUAYAQUIL", category: "Vehículos", purchase_date: "2016-06-01", purchase_value: 3570.68, useful_life_years: 5 },

  { id: "15", name: "MOBILIARIO Y ESCRITORIOS GERENCIA", category: "Equipo de Oficina", purchase_date: "2023-01-15", purchase_value: 14500.00, useful_life_years: 10 },
  { id: "16", name: "SILLAS ERGONÓMICAS Y ARCHIVADORES", category: "Equipo de Oficina", purchase_date: "2024-03-10", purchase_value: 4230.00, useful_life_years: 10 },
];

async function main() {
  const wb = XLSX.utils.book_new();

  // 1. Hoja con Plantilla Modelo de la Imagen
  const sampleCalc = buildCategoryGroups(SAMPLE_ATTACHED_ASSETS, 2026);
  const wsSample = buildWorksheet(sampleCalc.groups, sampleCalc.grandTotal, 2026, "FACOP S.A. - MODELO ADJUNTO");
  XLSX.utils.book_append_sheet(wb, wsSample, "Cédula Modelo Adjunta (2026)");

  // 2. Hoja con Activos Reales del Sistema FACOP
  let facopAssets = [];
  try {
    if (envVars.NEXT_PUBLIC_SUPABASE_URL && envVars.SUPABASE_SERVICE_ROLE_KEY) {
      const resp = await fetch(envVars.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/fixed_assets?select=*', {
        headers: {
          'apikey': envVars.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + envVars.SUPABASE_SERVICE_ROLE_KEY
        }
      });
      facopAssets = await resp.json();
    }
  } catch (err) {
    console.log("Error al consultar Supabase:", err.message);
  }

  if (Array.isArray(facopAssets) && facopAssets.length > 0) {
    const facopCalc = buildCategoryGroups(facopAssets, 2026);
    const wsFacop = buildWorksheet(facopCalc.groups, facopCalc.grandTotal, 2026, "FACOP S.A. - ACTIVOS EN VIVO");
    XLSX.utils.book_append_sheet(wb, wsFacop, "Activos FACOP en Vivo (2026)");
  }

  // Guardar en la raíz y en public/reportes
  const outPath1 = path.join(__dirname, '..', 'Reporte_Detalle_Activos_Fijos.xlsx');
  XLSX.writeFile(wb, outPath1);
  console.log('Archivo generado:', outPath1);

  const reportesDir = path.join(__dirname, '..', 'public', 'reportes');
  if (!fs.existsSync(reportesDir)) {
    fs.mkdirSync(reportesDir, { recursive: true });
  }
  const outPath2 = path.join(reportesDir, 'Reporte_Detalle_Activos_Fijos.xlsx');
  XLSX.writeFile(wb, outPath2);
  console.log('Archivo público generado:', outPath2);
}

main().catch(console.error);
