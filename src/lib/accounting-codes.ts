/**
 * Generador y formateador de Códigos Identificadores Contables Oficiales (NIIF / ERP)
 * 
 * Estructura de Códigos:
 * - Asiento de Diario General:     AS-YYYY-XXXXX   (ej: AS-2026-00001)
 * - Comprobante de Egreso (Pago):   EG-YYYY-XXXXX   (ej: EG-2026-00001)
 * - Comprobante de Ingreso (Cobro): ING-YYYY-XXXXX  (ej: ING-2026-00001)
 * - Nota de Crédito (Reversión):    NC-YYYY-XXXXX   (ej: NC-2026-00001)
 * - Asiento de Cierre Contable:     CR-YYYY-XXXXX   (ej: CR-2026-00001)
 */

export type VoucherKind = "diario" | "egreso" | "ingreso" | "nc" | "cierre";

export function formatAsientoCode(
  entryNum: number | string | null | undefined,
  entryDate?: string | null,
  kind: VoucherKind = "diario"
): string {
  const num = typeof entryNum === "number"
    ? entryNum
    : parseInt(String(entryNum || "1").replace(/\D/g, "") || "1", 10);

  const year = entryDate && entryDate.includes("-")
    ? entryDate.split("-")[0]
    : new Date().getFullYear();

  const seq = String(num).padStart(5, "0");

  switch (kind) {
    case "egreso":
      return `EG-${year}-${seq}`;
    case "ingreso":
      return `ING-${year}-${seq}`;
    case "nc":
      return `NC-${year}-${seq}`;
    case "cierre":
      return `CR-${year}-${seq}`;
    default:
      return `AS-${year}-${seq}`;
  }
}

export function formatEgresoCode(
  entryNum: number | string | null | undefined,
  entryDate?: string | null
): string {
  return formatAsientoCode(entryNum, entryDate, "egreso");
}

export function formatIngresoCode(
  entryNum: number | string | null | undefined,
  entryDate?: string | null
): string {
  return formatAsientoCode(entryNum, entryDate, "ingreso");
}
