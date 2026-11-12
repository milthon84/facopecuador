"use client";

import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";
import { formatAsientoCode } from "@/lib/accounting-codes";

interface Props {
  tab: string;
  period: string;
  periodLabel: string;
  entries?: any[];
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
          const refType =
            entry.reference_type === "invoice"
              ? "Venta (Factura)"
              : entry.reference_type === "expense"
              ? "Gasto (Compra)"
              : entry.reference_type === "credit_note"
              ? "Nota de Crédito"
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
        // Exportar Estado de Resultados
        const rows: any[] = [];

        // Encabezado de Ingresos
        rows.push({
          "Categoría NIIF": "INGRESOS OPERACIONALES",
          "Código": "",
          "Cuenta Contable": "",
          "Monto ($)": "",
        });

        const incomeRows = balanceRows.filter((r) => r.code.startsWith("4.") && r.credit > 0);
        incomeRows.forEach((r) => {
          rows.push({
            "Categoría NIIF": "Ingreso",
            "Código": r.code,
            "Cuenta Contable": r.name,
            "Monto ($)": Math.round((r.credit - r.debit) * 100) / 100,
          });
        });

        rows.push({
          "Categoría NIIF": "TOTAL INGRESOS",
          "Código": "",
          "Cuenta Contable": "",
          "Monto ($)": Math.round(ingresos * 100) / 100,
        });

        // Espacio
        rows.push({ "Categoría NIIF": "", "Código": "", "Cuenta Contable": "", "Monto ($)": "" });

        // Encabezado de Gastos
        rows.push({
          "Categoría NIIF": "COSTOS Y GASTOS OPERACIONALES",
          "Código": "",
          "Cuenta Contable": "",
          "Monto ($)": "",
        });

        const expenseRows = balanceRows.filter((r) => r.code.startsWith("5.") && r.debit > 0);
        expenseRows.forEach((r) => {
          rows.push({
            "Categoría NIIF": "Gasto",
            "Código": r.code,
            "Cuenta Contable": r.name,
            "Monto ($)": Math.round((r.debit - r.credit) * 100) / 100,
          });
        });

        rows.push({
          "Categoría NIIF": "TOTAL GASTOS",
          "Código": "",
          "Cuenta Contable": "",
          "Monto ($)": Math.round(gastos * 100) / 100,
        });

        // Espacio y Utilidad
        rows.push({ "Categoría NIIF": "", "Código": "", "Cuenta Contable": "", "Monto ($)": "" });
        rows.push({
          "Categoría NIIF": utilidad >= 0 ? "UTILIDAD NETA DEL PERÍODO" : "PÉRDIDA NETA DEL PERÍODO",
          "Código": "",
          "Cuenta Contable": `Período: ${periodLabel}`,
          "Monto ($)": Math.round(utilidad * 100) / 100,
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 30 },
          { wch: 15 },
          { wch: 40 },
          { wch: 16 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "Estado Resultados");
        XLSX.writeFile(wb, `Estado_Resultados_${periodSuffix}.xlsx`);

      } else if (tab === "balance") {
        // Exportar Balance de Comprobación con saldo anterior, movimientos del mes y saldo final acumulado
        let sumPrev = 0;
        let sumMonthDeb = 0;
        let sumMonthCred = 0;
        let sumFinal = 0;

        const rows = balanceRows.map((r) => {
          const prevBal = Number(r.prevBalance !== undefined ? r.prevBalance : (Number(r.prevDebit || 0) - Number(r.prevCredit || 0)));
          const mDeb = Number(r.monthDebit !== undefined ? r.monthDebit : r.debit);
          const mCred = Number(r.monthCredit !== undefined ? r.monthCredit : r.credit);
          const fBal = Number(r.finalBalance !== undefined ? r.finalBalance : (prevBal + mDeb - mCred));

          sumPrev += prevBal;
          sumMonthDeb += mDeb;
          sumMonthCred += mCred;
          sumFinal += fBal;

          return {
            "Código Cuenta": r.code,
            "Nombre Cuenta Contable": r.name,
            "Naturaleza": r.nature === "acreedora" ? "Acreedora" : "Deudora",
            "Saldo Mes Anterior ($)": Math.round(prevBal * 100) / 100,
            "Movimiento Mes Débito ($)": Math.round(mDeb * 100) / 100,
            "Movimiento Mes Crédito ($)": Math.round(mCred * 100) / 100,
            "Saldo Final Acumulado ($)": Math.round(fBal * 100) / 100,
          };
        });

        rows.push({
          "Código Cuenta": "TOTALES",
          "Nombre Cuenta Contable": Math.abs(sumMonthDeb - sumMonthCred) < 0.01 ? "Balance Cuadrado NIIF" : "Descuadrado",
          "Naturaleza": "-",
          "Saldo Mes Anterior ($)": Math.round(sumPrev * 100) / 100,
          "Movimiento Mes Débito ($)": Math.round(sumMonthDeb * 100) / 100,
          "Movimiento Mes Crédito ($)": Math.round(sumMonthCred * 100) / 100,
          "Saldo Final Acumulado ($)": Math.round(sumFinal * 100) / 100,
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 16 },
          { wch: 42 },
          { wch: 16 },
          { wch: 24 },
          { wch: 24 },
          { wch: 24 },
          { wch: 26 },
        ];
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
