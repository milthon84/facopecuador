/**
 * Utilidades de fecha/hora para la zona horaria de Ecuador (America/Guayaquil, UTC-5, sin horario de verano).
 * Son funciones puras: se usan tanto en el servidor como en componentes cliente.
 */

export const ECUADOR_TZ = "America/Guayaquil";
const ECUADOR_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha YYYY-MM-DD en hora Ecuador para un timestamp ISO. */
export function ecuadorDateOf(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ECUADOR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Hora HH:mm (24h) en hora Ecuador. */
export function ecuadorTimeOf(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: ECUADOR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Etiqueta completa "YYYY-MM-DD HH:mm" en hora Ecuador. Devuelve "" si la fecha no es válida. */
export function ecuadorDateTimeLabel(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  return `${ecuadorDateOf(d)} ${ecuadorTimeOf(d)}`;
}

/**
 * Convierte un rango de fechas Ecuador (YYYY-MM-DD, inclusive) en límites UTC
 * para consultar timestamps: [fromIso, toExclusiveIso).
 */
export function ecuadorRangeToUtc(startDate: string, endDate: string): { fromIso: string; toExclusiveIso: string } {
  const startUtcMidnight = Date.parse(`${startDate}T00:00:00Z`);
  const endUtcMidnight = Date.parse(`${endDate}T00:00:00Z`);
  return {
    fromIso: new Date(startUtcMidnight + ECUADOR_OFFSET_MS).toISOString(),
    toExclusiveIso: new Date(endUtcMidnight + DAY_MS + ECUADOR_OFFSET_MS).toISOString(),
  };
}
