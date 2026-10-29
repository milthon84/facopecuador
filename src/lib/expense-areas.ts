export type ExpenseArea = "clinica" | "cursos" | "general";

export const EXPENSE_AREA_CONFIG: Record<
  ExpenseArea,
  {
    id: ExpenseArea;
    label: string;
    shortLabel: string;
    description: string;
    badgeCls: string;
    activeBorderCls: string;
    activeBgCls: string;
    icon: string;
  }
> = {
  clinica: {
    id: "clinica",
    label: "Clínica Dental",
    shortLabel: "Clínica",
    description: "Insumos clínicos, honorarios odontológicos, instrumental y equipamiento dental",
    badgeCls: "bg-teal-50 text-teal-700 border-teal-200",
    activeBorderCls: "border-teal-500 ring-2 ring-teal-200",
    activeBgCls: "bg-teal-50/70 text-teal-950",
    icon: "Stethoscope",
  },
  cursos: {
    id: "cursos",
    label: "Cursos / Educación",
    shortLabel: "Cursos",
    description: "Honorarios docentes, coffee breaks, material de estudio y logística académica",
    badgeCls: "bg-indigo-50 text-indigo-700 border-indigo-200",
    activeBorderCls: "border-indigo-500 ring-2 ring-indigo-200",
    activeBgCls: "bg-indigo-50/70 text-indigo-950",
    icon: "GraduationCap",
  },
  general: {
    id: "general",
    label: "General / Administrativo",
    shortLabel: "General",
    description: "Arriendo general, suministros de oficina, servicios básicos compartidos y publicidad corporativa",
    badgeCls: "bg-amber-50 text-amber-700 border-amber-200",
    activeBorderCls: "border-amber-500 ring-2 ring-amber-200",
    activeBgCls: "bg-amber-50/70 text-amber-950",
    icon: "Building2",
  },
};

/**
 * Extrae la etiqueta [AREA:xxx] si fue guardada en el campo notes como respaldo
 */
export function extractAreaFromNotes(notes: string | null | undefined): ExpenseArea | null {
  if (!notes) return null;
  const match = notes.match(/\[AREA:(clinica|cursos|general)\]/i);
  if (match && match[1]) {
    return match[1].toLowerCase() as ExpenseArea;
  }
  return null;
}

/**
 * Incrusta la etiqueta [AREA:xxx] en notes preservando el resto de notas
 */
export function embedAreaInNotes(notes: string | null | undefined, area: ExpenseArea): string {
  const clean = (notes || "").replace(/\[AREA:[a-z]+\]/gi, "").trim();
  const tag = `[AREA:${area}]`;
  return clean ? `${tag} ${clean}` : tag;
}

/**
 * Determina de forma infalible a qué área pertenece un gasto
 */
export function resolveExpenseArea(expense: {
  area?: string | null;
  notes?: string | null;
  description?: string | null;
  category?: string | null;
}): ExpenseArea {
  if (expense.area && (expense.area === "clinica" || expense.area === "cursos" || expense.area === "general")) {
    return expense.area as ExpenseArea;
  }

  const fromNotes = extractAreaFromNotes(expense.notes);
  if (fromNotes) return fromNotes;

  const desc = (expense.description || "").toLowerCase();
  const cat = (expense.category || "").toLowerCase();

  if (
    desc.includes("curso") ||
    desc.includes("modulo") ||
    desc.includes("módulo") ||
    desc.includes("diplomado") ||
    desc.includes("docente") ||
    cat.includes("curso")
  ) {
    return "cursos";
  }

  if (
    cat.includes("arriendo") ||
    cat.includes("servicios básicos") ||
    cat.includes("suministros oficina") ||
    cat.includes("publicidad")
  ) {
    return "general";
  }

  return "clinica";
}

/**
 * Extrae la URL del comprobante de respaldo (desde el campo receipt_url o desde notes [COMPROBANTE:...])
 */
export function resolveReceiptUrl(expense: {
  receipt_url?: string | null;
  notes?: string | null;
}): string | null {
  if (expense.receipt_url) return expense.receipt_url;
  if (!expense.notes) return null;
  const match = expense.notes.match(/\[COMPROBANTE:([^\]]+)\]/i);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Extrae la clave de acceso de 49 dígitos del SRI vinculada a un gasto
 * (revisando campo factura_recibida_clave_acceso, etiqueta [FACTURA_SRI:...] en notes, o authorization_number)
 */
export function resolveFacturaSriClave(expense: {
  factura_recibida_clave_acceso?: string | null;
  authorization_number?: string | null;
  notes?: string | null;
}): string | null {
  if (expense.factura_recibida_clave_acceso && expense.factura_recibida_clave_acceso.trim().length === 49) {
    return expense.factura_recibida_clave_acceso.trim();
  }
  if (expense.notes) {
    const match = expense.notes.match(/\[FACTURA_SRI:([0-9]{49})\]/i);
    if (match && match[1]) return match[1].trim();
  }
  if (expense.authorization_number && expense.authorization_number.trim().length === 49) {
    return expense.authorization_number.trim();
  }
  return null;
}

/**
 * Limpia las etiquetas de sistema ([AREA:...], [COMPROBANTE:...], [FACTURA_SRI:...]) de las notas visibles
 */
export function cleanVisibleNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(/\[AREA:[a-z]+\]/gi, "")
    .replace(/\[COMPROBANTE:[^\]]+\]/gi, "")
    .replace(/\[FACTURA_SRI:[^\]]+\]/gi, "")
    .trim();
}

