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
  name: ExpenseItemCategory;
  accountCode: string;
  accountName: string;
  description: string;
  examples: string;
}

export const EXPENSE_CATEGORY_DETAILS: Record<ExpenseItemCategory, CategoryDetail> = {
  "Insumo y Material": {
    name: "Insumo y Material",
    accountCode: "5.1.01",
    accountName: "Insumos y Materiales Clínicos",
    description: "Insumos clínicos, odontológicos y materiales de atención",
    examples: "Guantes, gasas, anestesias, resinas, suturas, jeringas, instrumental descartable o menor, biomateriales, brackets y fármacos.",
  },
  "Suministro": {
    name: "Suministro",
    accountCode: "5.2.05",
    accountName: "Suministros Oficina y Aseo",
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
    accountCode: "5.2.03",
    accountName: "Servicios Básicos y Tercerizados",
    description: "Servicios básicos, mantenimientos, fletes y servicios externos",
    examples: "Agua potable, energía eléctrica, internet, telefonía, mantenimientos preventivos o correctivos de equipos, mensajería y seguridad.",
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
    accountCode: "5.2.09",
    accountName: "Impuestos, Tasas y Otros Gastos",
    description: "Seguros, suscripciones, tasas municipales y notariales",
    examples: "Pólizas de seguros médicos o de infraestructura, tasas de bomberos, patentes municipales, notariales y suscripciones a gremios.",
  },
};

/**
 * Normaliza categorías previas o alias (ej. "Materiales e Instrumental" -> "Insumo y Material")
 */
export function normalizeCategoryName(cat: string | null | undefined): ExpenseItemCategory {
  if (!cat) return "Insumo y Material";
  const trimmed = cat.trim();
  if (trimmed === "Materiales e Instrumental" || trimmed === "Insumos dentales") return "Insumo y Material";
  if (trimmed === "Seguros y Suscripciones" || trimmed === "Otros") return "Otros Gastos";
  if (trimmed === "Equipos") return "Activo fijo";
  if (trimmed === "Servicios básicos") return "Servicio";
  if (trimmed === "Suministros oficina") return "Suministro";
  if (EXPENSE_ITEM_CATEGORIES.includes(trimmed as any)) {
    return trimmed as ExpenseItemCategory;
  }
  return "Insumo y Material";
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
  quantity: number | string;
  unit_price: number | string;
  iva_rate: 0 | 15;
}

/**
 * Parsea el prefijo [Categoría] en la descripción si la columna category no existe en BD
 */
export function parseItemCategoryAndDesc(rawDesc: string | null | undefined): { category: string; description: string } {
  if (!rawDesc) return { category: "Insumo y Material", description: "" };
  const match = rawDesc.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    const cat = match[1].trim();
    const desc = match[2].trim();
    const normalized = normalizeCategoryName(cat);
    return { category: normalized, description: desc };
  }
  return { category: "Insumo y Material", description: rawDesc };
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
