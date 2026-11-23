"use client";

import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { formatAsientoCode } from "@/lib/accounting-codes";

interface Props {
  tab: string;
  period: string;
  periodLabel: string;
  view?: string;
  entries?: any[];
  hierarchicalRows?: Array<{
    type: "header" | "movement" | "subtotal";
    code: string;
    name: string;
    level: number;
    saldoAnterior: number;
    debe: number;
    haber: number;
    saldoActual: number;
  }>;
  balanceRows?: Array<{
    code: string;
    name: string;
    nature?: "deudora" | "acreedora";
    prevDebit?: number;
    prevCredit?: number;
    prevBalance?: number;
    monthDebit?: number;
    monthCredit?: number;
    debit: number;
    credit: number;
    finalDebit?: number;
    finalCredit?: number;
    finalBalance?: number;
  }>;
  ingresos?: number;
  gastos?: number;
  utilidad?: number;
  ivaData?: {
    ivaVentas: number;
    ivaCompras: number;
    ivaPagar: number;
  };
}

export default function ExportarExcelContableButton({
  tab,
  period,
  periodLabel,
  view = "tree",
  hierarchicalRows = [],
  entries = [],
  balanceRows = [],
  ingresos = 0,
  gastos = 0,
  utilidad = 0,
  ivaData,
}: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const periodSuffix = period === "all" ? "Todos_los_Periodos" : period;

      if (tab === "diario") {
        // Exportar Libro Diario / Mayor con todas las líneas de asientos
        const rows: any[] = [];
        let totalDebe = 0;
        let totalHaber = 0;

        entries.forEach((entry: any, entryIdx: number) => {
          const entryNum = entry.entry_number || entryIdx + 1;
          const descLower = (entry.description || "").toLowerCase();
          const refType =
            entry.reference_type === "invoice"
              ? "Venta (Factura)"
              : entry.reference_type === "expense"
              ? "Gasto (Compra)"
              : entry.reference_type === "credit_note" || descLower.includes("nota de crédito") || descLower.includes("nota de credito")
              ? "Nota de Crédito"
              : entry.reference_type === "manual"
              ? "Asiento Manual / Ajuste"
              : entry.reference_type || "Diario";

          const lines = entry.lines || [];
          lines.forEach((l: any) => {
            const deb = Number(l.debit || 0);
            const cred = Number(l.credit || 0);
            totalDebe += deb;
            totalHaber += cred;

            const isPago = (entry.description || "").toLowerCase().includes("pago") || (entry.description || "").toLowerCase().includes("cruce");
            const entryCode = entry.entry_code || formatAsientoCode(entryNum, entry.entry_date, isPago ? "egreso" : "diario");

            rows.push({
              "Fecha": entry.entry_date,
              "Código Asiento": entryCode,
              "Asiento N°": entryNum,
              "Tipo": refType,
              "Glosa / Descripción General": entry.description || "",
              "Código Cuenta": l.account_code,
              "Nombre Cuenta Contable": l.account_name,
              "Detalle Línea": l.description || "",
              "Debe ($)": deb > 0 ? deb : 0,
              "Haber ($)": cred > 0 ? cred : 0,
            });
          });
        });

        if (rows.length > 0) {
          rows.push({
            "Fecha": "TOTALES",
            "Asiento N°": `${entries.length} Asientos`,
            "Tipo": "",
            "Glosa / Descripción General": "Libro Diario General NIIF",
            "Código Cuenta": "",
            "Nombre Cuenta Contable": "",
            "Detalle Línea": "",
            "Debe ($)": Math.round(totalDebe * 100) / 100,
            "Haber ($)": Math.round(totalHaber * 100) / 100,
          });
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 12 }, // Fecha
          { wch: 12 }, // Asiento N°
          { wch: 18 }, // Tipo
          { wch: 38 }, // Glosa General
          { wch: 14 }, // Código
          { wch: 35 }, // Nombre Cuenta
          { wch: 30 }, // Detalle
          { wch: 14 }, // Debe
          { wch: 14 }, // Haber
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Libro Diario");
        XLSX.writeFile(wb, `Libro_Diario_Mayor_${periodSuffix}.xlsx`);

      } else if (tab === "resultados") {
        // ── ESTADO DE RESULTADOS (PyG) ──
        const rows: any[] = [];
        const totalIngrAcum = balanceRows
          .filter((r) => r.code.startsWith("4."))
          .reduce((s, r) => s + (r.finalBalance ?? 0), 0);
        const totalGastAcum = balanceRows
          .filter((r) => r.code.startsWith("5.") || r.code.startsWith("6."))
          .reduce((s, r) => s + (r.finalBalance ?? 0), 0);
        const utilAcum = totalIngrAcum - totalGastAcum;

        // Encabezado de Ingresos
        rows.push({
          "Categoría NIIF": "1. INGRESOS (CLASE 4)",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": "",
          "Monto Acumulado ($)": "",
        });

        const incomeRows = balanceRows.filter(
          (r) =>
            r.code.startsWith("4.") &&
            (Math.abs((r.monthCredit ?? r.credit ?? 0) - (r.monthDebit ?? r.debit ?? 0)) > 0.005 ||
              Math.abs(r.finalBalance ?? 0) > 0.005)
        );
        incomeRows.forEach((r) => {
          const mes = (r.monthCredit ?? r.credit ?? 0) - (r.monthDebit ?? r.debit ?? 0);
          const acum = r.finalBalance ?? 0;
          rows.push({
            "Categoría NIIF": "Ingreso",
            "Código": r.code,
            "Cuenta Contable": r.name,
            "Monto del Mes ($)": Math.round(mes * 100) / 100,
            "Monto Acumulado ($)": Math.round(acum * 100) / 100,
          });
        });

        rows.push({
          "Categoría NIIF": "TOTAL INGRESOS",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": Math.round(ingresos * 100) / 100,
          "Monto Acumulado ($)": Math.round(totalIngrAcum * 100) / 100,
        });

        // Espacio
        rows.push({
          "Categoría NIIF": "",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": "",
          "Monto Acumulado ($)": "",
        });

        // Encabezado de Gastos
        rows.push({
          "Categoría NIIF": "2. COSTOS Y GASTOS (CLASE 5 / 6)",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": "",
          "Monto Acumulado ($)": "",
        });

        const expenseRows = balanceRows.filter(
          (r) =>
            (r.code.startsWith("5.") || r.code.startsWith("6.")) &&
            (Math.abs((r.monthDebit ?? r.debit ?? 0) - (r.monthCredit ?? r.credit ?? 0)) > 0.005 ||
              Math.abs(r.finalBalance ?? 0) > 0.005)
        );
        expenseRows.forEach((r) => {
          const mes = (r.monthDebit ?? r.debit ?? 0) - (r.monthCredit ?? r.credit ?? 0);
          const acum = r.finalBalance ?? 0;
          rows.push({
            "Categoría NIIF": "Gasto",
            "Código": r.code,
            "Cuenta Contable": r.name,
            "Monto del Mes ($)": Math.round(mes * 100) / 100,
            "Monto Acumulado ($)": Math.round(acum * 100) / 100,
          });
        });

        rows.push({
          "Categoría NIIF": "TOTAL GASTOS",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": Math.round(gastos * 100) / 100,
          "Monto Acumulado ($)": Math.round(totalGastAcum * 100) / 100,
        });

        // Espacio y Utilidad
        rows.push({
          "Categoría NIIF": "",
          "Código": "",
          "Cuenta Contable": "",
          "Monto del Mes ($)": "",
          "Monto Acumulado ($)": "",
        });
        rows.push({
          "Categoría NIIF":
            utilAcum >= 0 ? "UTILIDAD NETA DEL EJERCICIO (NIIF)" : "PÉRDIDA NETA DEL EJERCICIO",
          "Código": "",
          "Cuenta Contable": `Período: ${periodLabel} | Conciliación trasladada a Situación Financiera`,
          "Monto del Mes ($)": Math.round(utilidad * 100) / 100,
          "Monto Acumulado ($)": Math.round(utilAcum * 100) / 100,
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 30 },
          { wch: 15 },
          { wch: 45 },
          { wch: 20 },
          { wch: 22 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Estado Resultados");
        XLSX.writeFile(wb, `Estado_Resultados_${periodSuffix}.xlsx`);

      } else if (tab === "balance") {
        // Exportar Balance de Comprobación idéntico al modelo oficial (CODIGO, NOMBRE DE LA CUENTA, SALDO ANTERIOR, DEBE, HABER, SALDO ACTUAL)
        let rows: any[] = [];
        let cols: any[] = [];

        if (view !== "flat" && hierarchicalRows && hierarchicalRows.length > 0) {
          // Formato Jerárquico NIIF con grupos y filas = TOTAL =
          rows = hierarchicalRows.map((r) => {
            if (r.type === "header") {
              return {
                "CODIGO": r.code,
                "NOMBRE DE LA CUENTA": r.name,
                "SALDO ANTERIOR": "",
                "DEBE": "",
                "HABER": "",
                "SALDO ACTUAL": "",
              };
            }
            const prefix = r.type === "movement" ? "   ".repeat(Math.max(1, r.level)) : "";
            return {
              "CODIGO": r.code,
              "NOMBRE DE LA CUENTA": prefix + r.name,
              "SALDO ANTERIOR": Math.round(r.saldoAnterior * 100) / 100,
              "DEBE": r.debe > 0 ? Math.round(r.debe * 100) / 100 : 0,
              "HABER": r.haber > 0 ? Math.round(r.haber * 100) / 100 : 0,
              "SALDO ACTUAL": Math.round(r.saldoActual * 100) / 100,
            };
          });

          const totalDeb = balanceRows.reduce((s, r) => s + (r.monthDebit ?? r.debit ?? 0), 0);
          const totalCred = balanceRows.reduce((s, r) => s + (r.monthCredit ?? r.credit ?? 0), 0);
          const totalPrevDeudor = balanceRows.reduce((s, r) => s + (r.nature === "deudora" ? (r.prevBalance ?? 0) : 0), 0);
          const totalPrevAcreedor = balanceRows.reduce((s, r) => s + (r.nature === "acreedora" ? (r.prevBalance ?? 0) : 0), 0);
          const totalFinalDeudor = balanceRows.reduce((s, r) => s + (r.nature === "deudora" ? (r.finalBalance ?? 0) : 0), 0);
          const totalFinalAcreedor = balanceRows.reduce((s, r) => s + (r.nature === "acreedora" ? (r.finalBalance ?? 0) : 0), 0);

          rows.push({
            "CODIGO": "= TOTAL MOVIMIENTOS =",
            "NOMBRE DE LA CUENTA": Math.abs(totalDeb - totalCred) < 0.01 ? "MOVIMIENTOS DEL MES CUADRADOS (DEBE = HABER)" : "DESCUADRE EN MOVIMIENTOS",
            "SALDO ANTERIOR": "",
            "DEBE": Math.round(totalDeb * 100) / 100,
            "HABER": Math.round(totalCred * 100) / 100,
            "SALDO ACTUAL": "",
          });
          rows.push({
            "CODIGO": "= SALDOS DEUDORES =",
            "NOMBRE DE LA CUENTA": "SUMA DE SALDOS DEUDORES (ACTIVOS + GASTOS)",
            "SALDO ANTERIOR": Math.round(totalPrevDeudor * 100) / 100,
            "DEBE": "",
            "HABER": "",
            "SALDO ACTUAL": Math.round(totalFinalDeudor * 100) / 100,
          });
          rows.push({
            "CODIGO": "= SALDOS ACREEDORES =",
            "NOMBRE DE LA CUENTA": "SUMA DE SALDOS ACREEDORES (PASIVO + PATRIMONIO + INGRESOS)",
            "SALDO ANTERIOR": Math.round(totalPrevAcreedor * 100) / 100,
            "DEBE": "",
            "HABER": "",
            "SALDO ACTUAL": Math.round(totalFinalAcreedor * 100) / 100,
          });
          rows.push({
            "CODIGO": "= CUADRE NIIF =",
            "NOMBRE DE LA CUENTA": Math.abs(totalFinalDeudor - totalFinalAcreedor) < 0.01 ? "SUMAS IGUALES CUADRADAS EXACTAS (DIFERENCIA $0.00)" : "DESCUADRE EN SALDOS",
            "SALDO ANTERIOR": Math.round(Math.abs(totalPrevDeudor - totalPrevAcreedor) * 100) / 100,
            "DEBE": Math.round(Math.abs(totalDeb - totalCred) * 100) / 100,
            "HABER": "",
            "SALDO ACTUAL": Math.round(Math.abs(totalFinalDeudor - totalFinalAcreedor) * 100) / 100,
          });

          cols = [
            { wch: 18 },
            { wch: 55 },
            { wch: 20 },
            { wch: 20 },
            { wch: 20 },
            { wch: 20 },
          ];
        } else {
          // Formato de solo cuentas de movimiento
          const isAcreedoraCode = (code: string) => code.startsWith("2") || code.startsWith("3") || code.startsWith("4");
          let sumMonthDeb = 0;
          let sumMonthCred = 0;
          let sumPrevDeudor = 0;
          let sumPrevAcreedor = 0;
          let sumFinalDeudor = 0;
          let sumFinalAcreedor = 0;

          rows = balanceRows.map((r) => {
            const isAcreed = r.nature === "acreedora" || isAcreedoraCode(r.code);
            const prevBal = Number(r.prevBalance !== undefined ? r.prevBalance : (isAcreed ? (Number(r.prevCredit || 0) - Number(r.prevDebit || 0)) : (Number(r.prevDebit || 0) - Number(r.prevCredit || 0))));
            const mDeb = Number(r.monthDebit !== undefined ? r.monthDebit : r.debit);
            const mCred = Number(r.monthCredit !== undefined ? r.monthCredit : r.credit);
            const fBal = Number(r.finalBalance !== undefined ? r.finalBalance : (isAcreed ? (prevBal + mCred - mDeb) : (prevBal + mDeb - mCred)));

            sumMonthDeb += mDeb;
            sumMonthCred += mCred;
            if (isAcreed) {
              sumPrevAcreedor += prevBal;
              sumFinalAcreedor += fBal;
            } else {
              sumPrevDeudor += prevBal;
              sumFinalDeudor += fBal;
            }

            return {
              "CODIGO": r.code,
              "NOMBRE DE LA CUENTA": r.name,
              "SALDO ANTERIOR": Math.round(prevBal * 100) / 100,
              "DEBE": Math.round(mDeb * 100) / 100,
              "HABER": Math.round(mCred * 100) / 100,
              "SALDO ACTUAL": Math.round(fBal * 100) / 100,
            };
          });

          rows.push({
            "CODIGO": "= TOTAL MOVIMIENTOS =",
            "NOMBRE DE LA CUENTA": Math.abs(sumMonthDeb - sumMonthCred) < 0.01 ? "MOVIMIENTOS DEL MES CUADRADOS (DEBE = HABER)" : "DESCUADRE EN MOVIMIENTOS",
            "SALDO ANTERIOR": "",
            "DEBE": Math.round(sumMonthDeb * 100) / 100,
            "HABER": Math.round(sumMonthCred * 100) / 100,
            "SALDO ACTUAL": "",
          });
          rows.push({
            "CODIGO": "= SALDOS DEUDORES =",
            "NOMBRE DE LA CUENTA": "SUMA DE SALDOS DEUDORES (ACTIVOS + GASTOS)",
            "SALDO ANTERIOR": Math.round(sumPrevDeudor * 100) / 100,
            "DEBE": "",
            "HABER": "",
            "SALDO ACTUAL": Math.round(sumFinalDeudor * 100) / 100,
          });
          rows.push({
            "CODIGO": "= SALDOS ACREEDORES =",
            "NOMBRE DE LA CUENTA": "SUMA DE SALDOS ACREEDORES (PASIVO + PATRIMONIO + INGRESOS)",
            "SALDO ANTERIOR": Math.round(sumPrevAcreedor * 100) / 100,
            "DEBE": "",
            "HABER": "",
            "SALDO ACTUAL": Math.round(sumFinalAcreedor * 100) / 100,
          });
          rows.push({
            "CODIGO": "= CUADRE NIIF =",
            "NOMBRE DE LA CUENTA": Math.abs(sumFinalDeudor - sumFinalAcreedor) < 0.01 ? "SUMAS IGUALES CUADRADAS EXACTAS (DIFERENCIA $0.00)" : "DESCUADRE EN SALDOS",
            "SALDO ANTERIOR": Math.round(Math.abs(sumPrevDeudor - sumPrevAcreedor) * 100) / 100,
            "DEBE": Math.round(Math.abs(sumMonthDeb - sumMonthCred) * 100) / 100,
            "HABER": "",
            "SALDO ACTUAL": Math.round(Math.abs(sumFinalDeudor - sumFinalAcreedor) * 100) / 100,
          });

          cols = [
            { wch: 18 },
            { wch: 55 },
            { wch: 20 },
            { wch: 20 },
            { wch: 20 },
            { wch: 20 },
          ];
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = cols;
        XLSX.utils.book_append_sheet(wb, ws, "Balance Comprobación");
        XLSX.writeFile(wb, `Balance_Comprobacion_${periodSuffix}.xlsx`);

      } else if (tab === "iva" && ivaData) {
        // Exportar Resumen IVA
        const rows = [
          { "Concepto": "IVA en Ventas (Generado / Débito Fiscal)", "Cuenta": "2.1.02.01", "Monto ($)": Math.round(ivaData.ivaVentas * 100) / 100 },
          { "Concepto": "IVA en Compras (Crédito Tributario)", "Cuenta": "1.1.03.01", "Monto ($)": Math.round(ivaData.ivaCompras * 100) / 100 },
          {
            "Concepto": ivaData.ivaPagar >= 0 ? "Impuesto a Pagar al SRI" : "Crédito Tributario a Favor",
            "Cuenta": "Liquidación NIIF Form. 104",
            "Monto ($)": Math.round(Math.abs(ivaData.ivaPagar) * 100) / 100,
          },
        ];

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 40 }, { wch: 25 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws, "Resumen IVA");
        XLSX.writeFile(wb, `Resumen_IVA_Form104_${periodSuffix}.xlsx`);
      }
    } catch (err) {
      console.error("Error al exportar a Excel:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 hover:text-ink-900 text-xs font-bold shadow-2xs hover:border-lilac-300 transition active:scale-[0.98] disabled:opacity-60"
      title={`Exportar ${tab === "diario" ? "Libro Diario / Mayor" : tab === "resultados" ? "Estado de Resultados" : tab === "balance" ? "Balance de Comprobación" : "Resumen IVA"} a Excel (.xlsx)`}
    >
      {exporting ? (
        <Loader2 size={13} className="animate-spin text-lilac-600" />
      ) : (
        <FileSpreadsheet size={13} className="text-emerald-600" />
      )}
      <span>{exporting ? "Generando Excel..." : "Exportar Excel"}</span>
    </button>
  );
}
