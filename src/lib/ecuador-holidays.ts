/**
 * Utilidades para cálculo y consulta de Feriados Nacionales del Ecuador
 * Basado en la Ley Orgánica de Servicio Público (LOSEP) y la Ley de Feriados de Ecuador.
 */

export interface EcuadorHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  type: "nacional";
  description: string;
  isVariable?: boolean;
}

/**
 * Calcula el Domingo de Resurrección (Pascua) para un año dado usando el algoritmo de Gauss / Computus.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based: 2=March, 3=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retorna la lista de feriados nacionales oficiales para un año determinado en Ecuador.
 */
export function getEcuadorHolidays(year: number): EcuadorHoliday[] {
  const easter = getEasterSunday(year);

  // Carnaval: lunes (-48 días) y martes (-47 días) antes de Pascua
  const carnavalLunes = addDays(easter, -48);
  const carnavalMartes = addDays(easter, -47);

  // Viernes Santo: 2 días antes de Pascua
  const viernesSanto = addDays(easter, -2);

  const holidays: EcuadorHoliday[] = [
    {
      date: `${year}-01-01`,
      name: "Año Nuevo",
      type: "nacional",
      description: "Feriado Nacional obligatorio",
    },
    {
      date: formatDate(carnavalLunes),
      name: "Carnaval (Lunes)",
      type: "nacional",
      description: "Feriado Nacional de Carnaval",
      isVariable: true,
    },
    {
      date: formatDate(carnavalMartes),
      name: "Carnaval (Martes)",
      type: "nacional",
      description: "Feriado Nacional de Carnaval",
      isVariable: true,
    },
    {
      date: formatDate(viernesSanto),
      name: "Viernes Santo",
      type: "nacional",
      description: "Semana Santa - Feriado Nacional obligatorio",
      isVariable: true,
    },
    {
      date: `${year}-05-01`,
      name: "Día del Trabajo",
      type: "nacional",
      description: "Día Internacional de los Trabajadores",
    },
    {
      date: `${year}-05-24`,
      name: "Batalla del Pichincha",
      type: "nacional",
      description: "Conmemoración de la Batalla del Pichincha",
    },
    {
      date: `${year}-08-10`,
      name: "Primer Grito de Independencia",
      type: "nacional",
      description: "Fiesta Nacional de la Independencia",
    },
    {
      date: `${year}-10-09`,
      name: "Independencia de Guayaquil",
      type: "nacional",
      description: "Feriado Nacional por la Independencia de Guayaquil",
    },
    {
      date: `${year}-11-02`,
      name: "Día de los Difuntos",
      type: "nacional",
      description: "Conmemoración del Día de los Difuntos",
    },
    {
      date: `${year}-11-03`,
      name: "Independencia de Cuenca",
      type: "nacional",
      description: "Feriado Nacional por la Independencia de Cuenca",
    },
    {
      date: `${year}-12-25`,
      name: "Navidad",
      type: "nacional",
      description: "Celebración de la Navidad",
    },
  ];

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Consulta si una fecha específica (YYYY-MM-DD) es feriado nacional en Ecuador.
 */
export function isEcuadorHoliday(dateStr: string): EcuadorHoliday | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  const holidays = getEcuadorHolidays(year);
  return holidays.find((h) => h.date === dateStr) || null;
}

/**
 * Retorna todos los feriados comprendidos en un rango de fechas.
 */
export function getHolidaysInRange(startDateStr: string, endDateStr: string): EcuadorHoliday[] {
  const startYear = parseInt(startDateStr.slice(0, 4), 10);
  const endYear = parseInt(endDateStr.slice(0, 4), 10);

  const allHolidays: EcuadorHoliday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    allHolidays.push(...getEcuadorHolidays(y));
  }

  return allHolidays.filter((h) => h.date >= startDateStr && h.date <= endDateStr);
}
