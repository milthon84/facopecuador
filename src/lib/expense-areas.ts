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
    desc.includes("arriendo") ||
    desc.includes("alquiler") ||
    desc.includes("oficina") ||
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
 * Extrae la URL del comprobante de pago / transferencia bancaria (desde notes [COMPROBANTE_PAGO:...])
 */
export function resolvePaymentReceiptUrl(expense: {
  notes?: string | null;
  payment_reference?: string | null;
}): string | null {
  if (!expense.notes) return null;
  const match = expense.notes.match(/\[COMPROBANTE_PAGO:([^\]]+)\]/i);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Extrae la clave de acceso de 49 dígitos del SRI vinculada a un gasto
 * (revisando campo factura_recibida_clave_acceso, notes, authorization_number o description)
 */
export function resolveFacturaSriClave(expense: {
  factura_recibida_clave_acceso?: string | null;
  authorization_number?: string | null;
  notes?: string | null;
  description?: string | null;
  clave_acceso?: string | null;
}): string | null {
  if (expense.factura_recibida_clave_acceso && expense.factura_recibida_clave_acceso.trim().length === 49) {
    return expense.factura_recibida_clave_acceso.trim();
  }
  if (expense.clave_acceso && expense.clave_acceso.trim().length === 49) {
    return expense.clave_acceso.trim();
  }
  if (expense.notes) {
    const match = expense.notes.match(/\[FACTURA_SRI:([0-9]{49})\]/i);
    if (match && match[1]) return match[1].trim();
    const rawMatch = expense.notes.match(/\b([0-9]{49})\b/);
    if (rawMatch && rawMatch[1]) return rawMatch[1].trim();
  }
  if (expense.authorization_number) {
    const trimmed = expense.authorization_number.trim();
    if (trimmed.length === 49 && /^[0-9]{49}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/\b([0-9]{49})\b/);
    if (match && match[1]) return match[1].trim();
  }
  if (expense.description) {
    const match = expense.description.match(/\b([0-9]{49})\b/);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

/**
 * Determina el tipo de comprobante de un gasto: "factura" | "nota_venta" | "sin_documento"
 */
export function resolveExpenseDocType(expense: {
  document_number?: string | null;
  notes?: string | null;
  factura_recibida_clave_acceso?: string | null;
  authorization_number?: string | null;
}): "factura" | "nota_venta" | "sin_documento" {
  if (
    expense.factura_recibida_clave_acceso ||
    expense.authorization_number?.length === 49 ||
    expense.notes?.includes("[FACTURA_SRI:")
  ) {
    return "factura";
  }

  const match = expense.notes?.match(/\[TIPO:(factura|nota_venta|sin_documento)\]/i);
  if (match && match[1]) return match[1].toLowerCase() as any;

  const doc = (expense.document_number || "").toLowerCase().trim();
  if (!doc) return "sin_documento";
  if (doc.includes("nota") || doc.includes("nv")) return "nota_venta";
  return "factura";
}

/**
 * Extrae únicamente la serie y número del comprobante (ej: "001-100-000000203"),
 * eliminando prefijos redundantes como "Factura ", "Nota de Venta ", "Liquidación ", etc.
 */
export function cleanDocNumberOnly(raw: string | null | undefined): string {
  if (!raw) return "";
  let val = raw.trim();
  // Quitar símbolos iniciales como #
  val = val.replace(/^#+\s*/, "");
  // Quitar prefijos de comprobante (insensible a mayúsculas/minúsculas y acentos)
  val = val.replace(
    /^(?:factura(?:\s+electr[oó]nica|\s+sri)?|nota\s+de\s+(?:venta|cr[eé]dito|d[eé]bito)|liquidaci[oó]n(?:\s+de\s+compra)?|comprobante(?:\s+de\s+retenci[oó]n)?|recibo|ndv|nv|n\/v)\s*[:#\-]?\s*/i,
    ""
  );
  return val.trim();
}

/**
 * Retorna la etiqueta amigable del tipo de comprobante para mostrar ("Factura", "Nota de Venta", "Liquidación", "Recibo", etc.)
 */
export function getExpenseDocTypeLabel(expense: {
  document_number?: string | null;
  notes?: string | null;
  factura_recibida_clave_acceso?: string | null;
  authorization_number?: string | null;
}): string {
  const rawDoc = (expense.document_number || "").toLowerCase();
  if (rawDoc.includes("nota") || rawDoc.includes("nv")) {
    return "Nota de Venta";
  }
  if (rawDoc.includes("liquidaci")) {
    return "Liquidación";
  }
  if (rawDoc.includes("recibo")) {
    return "Recibo";
  }

  const docType = resolveExpenseDocType(expense);
  if (docType === "nota_venta") return "Nota de Venta";
  if (docType === "sin_documento") return "Sin Comprobante";
  return "Factura";
}

/**
 * Formatea el número de comprobante para listados anteponiendo el tipo:
 * Ej: "#Factura 001-100-000000013" o "#Nota de Venta 001-001-000001"
 */
export function formatExpenseDocNumber(expense: {
  document_number?: string | null;
  notes?: string | null;
  factura_recibida_clave_acceso?: string | null;
  authorization_number?: string | null;
}): string | null {
  const cleanNum = cleanDocNumberOnly(expense.document_number);
  if (!cleanNum) return null;
  const label = getExpenseDocTypeLabel(expense);
  return `#${label} ${cleanNum}`;
}

/**
 * Limpia las etiquetas de sistema ([AREA:...], [COMPROBANTE:...], [COMPROBANTE_PAGO:...], [FACTURA_SRI:...], [TIPO:...]) de las notas visibles
 */
export function cleanVisibleNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .replace(/\[AREA:[a-z]+\]/gi, "")
    .replace(/\[COMPROBANTE:[^\]]+\]/gi, "")
    .replace(/\[COMPROBANTE_PAGO:[^\]]+\]/gi, "")
    .replace(/\[FACTURA_SRI:[^\]]+\]/gi, "")
    .replace(/\[TIPO:[a-z_]+\]/gi, "")
    .trim();
}

