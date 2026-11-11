export const EXPENSE_ITEM_CATEGORIES = [
  "Insumo y Material",
  "Suministro",
  "Activo fijo",
  "Servicio",
  "Software y Licencias",
  "Otros Gastos",
] as const;

export type ExpenseItemCategory = (typeof EXPENSE_ITEM_CATEGORIES)[number];

export interface CategoryDetail {
  name: string;
  accountCode: string;
  accountName: string;
  description: string;
  examples: string;
}

export const EXPENSE_CATEGORY_DETAILS: Record<string, CategoryDetail> = {
  "Insumo y Material": {
    name: "Insumo y Material",
    accountCode: "5.1.01.01",
    accountName: "Insumos Dentales Utilizados",
    description: "Insumos clínicos, odontológicos y materiales de atención",
    examples: "Guantes, gasas, anestesias, resinas, suturas, jeringas, instrumental descartable o menor, biomateriales, brackets y fármacos.",
  },
  "Honorarios Externos (Contabilidad)": {
    name: "Honorarios Externos (Contabilidad)",
    accountCode: "5.2.07.01",
    accountName: "Honorarios Externos (Contabilidad)",
    description: "Servicios contables, tributarios, auditoría y conformación societaria",
    examples: "Asesoría contable mensual, declaraciones SRI, balances SuperCías, conformación de sociedad y asesoría legal/financiera.",
  },
  "Honorarios Externos": {
    name: "Honorarios Externos",
    accountCode: "5.2.07.01",
    accountName: "Honorarios Externos (Contabilidad)",
    description: "Honorarios por servicios profesionales externos",
    examples: "Contabilidad, asesoría jurídica, auditoría externa, consultoría administrativa.",
  },
  "Honorarios Profesionales": {
    name: "Honorarios Profesionales",
    accountCode: "5.1.02.04",
    accountName: "Honorarios Otros Profesionales",
    description: "Honorarios médicos, odontológicos y docentes",
    examples: "Odontólogos especialistas asociados, docentes de cursos, laboratoristas dentales.",
  },
  "Suministro": {
    name: "Suministro",
    accountCode: "5.2.05.01",
    accountName: "Útiles de Oficina",
    description: "Artículos de papelería, oficina, limpieza y cafetería",
    examples: "Papel bond, tóner, archivadores, cloro, desinfectantes, papel higiénico, jabón, café, azúcar y útiles de oficina.",
  },
  "Activo fijo": {
    name: "Activo fijo",
    accountCode: "1.2.01.01",
    accountName: "Equipos Médicos y Odontológicos / PPE",
    description: "Equipamiento de larga duración, maquinaria y mobiliario",
    examples: "Sillones dentales, rayos X, compresores, autoclaves, lámparas de fotocurado, mobiliario clínico, escritorios y computadoras físicas.",
  },
  "Servicio": {
    name: "Servicio",
    accountCode: "5.2.03.01",
    accountName: "Energía Eléctrica",
    description: "Servicios básicos, mantenimientos, fletes y servicios externos",
    examples: "Agua potable, energía eléctrica, internet, telefonía, Datafast, mantenimientos preventivos o correctivos de equipos, mensajería y seguridad.",
  },
  "Software y Licencias": {
    name: "Software y Licencias",
    accountCode: "1.2.01.03",
    accountName: "Equipos de Computación y Software",
    description: "Sistemas informáticos, plataformas digitales y software",
    examples: "Sistemas odontológicos/médicos, Microsoft 365, Google Workspace, Adobe, antivirus, hosting web y suscripciones cloud.",
  },
  "Otros Gastos": {
    name: "Otros Gastos",
    accountCode: "5.2.19.01",
    accountName: "Alimentación Cafetería",
    description: "Gastos varios no clasificados, cafetería y otros misceláneos",
    examples: "Refrigerios, alimentación de personal, gastos menores no categorizados.",
  },
};

/**
 * Normaliza categorías previas o alias (ej. "Materiales e Instrumental" -> "Insumo y Material")
 * pero PRESERVA categorías válidas como "Honorarios Externos (Contabilidad)", "Útiles de Aseo", etc.
 */
export function normalizeCategoryName(cat: string | null | undefined): string {
  if (!cat) return "";
  const trimmed = cat.trim();
  if (!trimmed) return "";
  if (trimmed === "Materiales e Instrumental" || trimmed === "Insumos dentales") return "Insumo y Material";
  if (trimmed === "Seguros y Suscripciones" || trimmed === "Otros") return "Otros Gastos";
  if (trimmed === "Equipos") return "Activo fijo";
  if (trimmed === "Servicios básicos") return "Servicio";
  if (trimmed === "Suministros oficina") return "Suministro";
  return trimmed;
}

/**
 * Resuelve la información contable (nombre y código de cuenta) para un ítem o categoría de gasto.
 */
export function resolveExpenseItemCategoryDetail(
  catName?: string | null,
  accountCode?: string | null,
  accountName?: string | null
): { name: string; accountCode: string; description?: string } {
  // 1. Por código de cuenta conocido
  if (accountCode) {
    const code = accountCode.trim();
    if (code === "5.2.07.01" || code === "5.2.07") {
      return { name: "Honorarios Externos (Contabilidad)", accountCode: "5.2.07.01", description: "Servicios contables y asesoría externa" };
    }
    if (code === "5.1.01.01" || code === "5.1.01") {
      return { name: "Insumo y Material", accountCode: "5.1.01.01", description: "Insumos Dentales Utilizados" };
    }
    if (code === "5.2.05.01" || code === "5.2.05") {
      return { name: "Útiles de Oficina", accountCode: "5.2.05.01", description: "Suministros y Útiles de Oficina" };
    }
    if (code === "5.2.05.02") {
      return { name: "Útiles de Aseo", accountCode: "5.2.05.02", description: "Artículos de Aseo y Limpieza" };
    }
    if (code === "1.2.01.01") {
      return { name: "Activo fijo", accountCode: "1.2.01.01", description: "Equipos Médicos y Odontológicos" };
    }
    if (code === "5.2.03.01") {
      return { name: "Servicio", accountCode: "5.2.03.01", description: "Energía Eléctrica y Servicios Básicos" };
    }
    if (code === "1.2.01.03") {
      return { name: "Software y Licencias", accountCode: "1.2.01.03", description: "Equipos de Computación y Software" };
    }
    if (code === "5.2.19.01") {
      return { name: "Otros Gastos", accountCode: "5.2.19.01", description: "Alimentación Cafetería / Misceláneos" };
    }
    if (code.startsWith("5.1.02")) {
      return { name: accountName || "Honorarios Profesionales", accountCode: code, description: "Honorarios Profesionales" };
    }
  }

  // 2. Por coincidencia en EXPENSE_CATEGORY_DETAILS
  const normalized = normalizeCategoryName(catName || accountName);
  if (normalized && EXPENSE_CATEGORY_DETAILS[normalized]) {
    const d = EXPENSE_CATEGORY_DETAILS[normalized];
    return { name: d.name, accountCode: d.accountCode, description: d.description };
  }

  // 3. Chequeos de palabras clave en la categoría / cuenta
  const searchStr = `${catName || ""} ${accountName || ""}`.toLowerCase();
  if (searchStr.includes("honorario") || searchStr.includes("contab") || searchStr.includes("asesor")) {
    return {
      name: "Honorarios Externos (Contabilidad)",
      accountCode: "5.2.07.01",
      description: "Servicios contables, tributarios y asesoría externa",
    };
  }
  if (searchStr.includes("insumo") || searchStr.includes("dental") || searchStr.includes("material")) {
    return {
      name: "Insumo y Material",
      accountCode: "5.1.01.01",
      description: "Insumos Dentales Utilizados",
    };
  }
  if (searchStr.includes("suministro") || searchStr.includes("oficina") || searchStr.includes("utiles")) {
    return {
      name: "Suministro",
      accountCode: "5.2.05.01",
      description: "Útiles de Oficina",
    };
  }
  if (searchStr.includes("activo") || searchStr.includes("equipo")) {
    return {
      name: "Activo fijo",
      accountCode: "1.2.01.01",
      description: "Equipos Médicos y Odontológicos",
    };
  }

  // 4. Fallback con el nombre y código que tenga
  const finalName = normalized || accountName || catName || "Gasto Operacional";
  const finalCode = accountCode || "5.2.05.01";
  return { name: finalName, accountCode: finalCode };
}

export interface FacturaRecibida {
  clave_acceso: string;
  ruc_emisor: string | null;
  razon_social: string | null;
  numero_comprobante: string | null;
  fecha_emision: string | null;
  fecha_autorizacion?: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  estado_facop: string; // 'pendiente' | 'registrado' | 'ignorado'
  expense_id?: string | null;
  created_at?: string;
}

export interface ExpenseItem {
  id?: string;
  expense_id?: string;
  description: string;
  category?: string | null;
  group_code?: string | null;
  group_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  quantity: number;
  unit_price: number;
  iva_rate: number; // 15 o 0
  subtotal: number;
  iva_amount: number;
  total: number;
}

export interface ExpenseItemRow {
  id: string; // id temporal en cliente (e.g. "row-1")
  description: string;
  category?: string;
  group_code?: string;
  group_name?: string;
  account_code?: string;
  account_name?: string;
  quantity: number | string;
  unit_price: number | string;
  iva_rate: 0 | 15;
}

/**
 * Parsea el prefijo [Categoría] en la descripción si la columna category no existe en BD
 */
export function parseItemCategoryAndDesc(rawDesc: string | null | undefined): { category: string; description: string } {
  if (!rawDesc) return { category: "", description: "" };
  const match = rawDesc.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const cat = match[1].trim();
    const desc = match[2].trim();
    const normalized = normalizeCategoryName(cat);
    return { category: normalized, description: desc };
  }
  return { category: "", description: rawDesc };
}

export function formatItemDescription(category: string | undefined | null, desc: string): string {
  const cleanDesc = (desc || "").trim();
  if (!category) return cleanDesc;
  // Si ya tiene el tag, evitar duplicarlo
  if (cleanDesc.startsWith(`[${category}]`)) return cleanDesc;
  return `[${category}] ${cleanDesc}`;
}

export function calculateItemRow(row: ExpenseItemRow) {
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unit_price) || 0;
  const subtotal = Math.round(qty * price * 100) / 100;
  const iva = row.iva_rate === 15 ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
  const total = Math.round((subtotal + iva) * 100) / 100;
  return { qty, price, subtotal, iva, total };
}

export function calculateExpenseTotals(items: ExpenseItemRow[]) {
  let subtotal0 = 0;
  let subtotal15 = 0;
  let ivaAmount = 0;

  for (const item of items) {
    const { subtotal, iva } = calculateItemRow(item);
    if (item.iva_rate === 15) {
      subtotal15 += subtotal;
      ivaAmount += iva;
    } else {
      subtotal0 += subtotal;
    }
  }

  subtotal0 = Math.round(subtotal0 * 100) / 100;
  subtotal15 = Math.round(subtotal15 * 100) / 100;
  ivaAmount = Math.round(ivaAmount * 100) / 100;
  const total = Math.round((subtotal0 + subtotal15 + ivaAmount) * 100) / 100;

  return {
    subtotal0,
    subtotal15,
    ivaAmount,
    total,
    subtotal: Math.round((subtotal0 + subtotal15) * 100) / 100,
  };
}
