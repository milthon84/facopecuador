export interface TaxDeclarationDocument {
  id: string;
  period: string; // "YYYY-MM"
  year: number;
  month: number;
  document_type: TaxDocType;
  title: string;
  file_url: string;
  storage_path: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  notes?: string | null;
  uploaded_by_id?: string | null;
  uploaded_by_email?: string | null;
  created_at: string;
  updated_at?: string;
}

export type TaxDocType =
  | "iva_104"
  | "retenciones_103"
  | "pago_sri"
  | "ats"
  | "renta_101"
  | "retenciones_recibidas"
  | "otro";

export interface TaxDocCategoryDef {
  id: TaxDocType;
  label: string;
  shortLabel: string;
  code: string;
  color: string; // Tailwind classes
  badgeColor: string;
  description: string;
  defaultTitleTemplate: (monthName: string, year: number) => string;
}

export const TAX_DOC_CATEGORIES: TaxDocCategoryDef[] = [
  {
    id: "iva_104",
    label: "Formulario 104 — Declaración de IVA",
    shortLabel: "Form. 104 (IVA)",
    code: "104",
    color: "emerald",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Declaración mensual o semestral del Impuesto al Valor Agregado",
    defaultTitleTemplate: (m, y) => `Declaración IVA Form. 104 - ${m} ${y}`,
  },
  {
    id: "retenciones_103",
    label: "Formulario 103 — Retenciones en la Fuente",
    shortLabel: "Form. 103 (Retenciones)",
    code: "103",
    color: "blue",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Declaración mensual de retenciones en la fuente de Impuesto a la Renta",
    defaultTitleTemplate: (m, y) => `Declaración Retenciones Form. 103 - ${m} ${y}`,
  },
  {
    id: "pago_sri",
    label: "Comprobante de Pago SRI / Débito (CEEP)",
    shortLabel: "Pago SRI / CEEP",
    code: "CEEP",
    color: "indigo",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description: "Comprobante Electrónico de Pago (CEEP), convenio de débito o papeleta bancaria",
    defaultTitleTemplate: (m, y) => `Comprobante de Pago SRI - ${m} ${y}`,
  },
  {
    id: "ats",
    label: "ATS — Talón Resumen / Anexo Transaccional",
    shortLabel: "ATS / Anexo",
    code: "ATS",
    color: "purple",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
    description: "Talón resumen generado por el SRI o archivo XML/ZIP del Anexo Transaccional",
    defaultTitleTemplate: (m, y) => `Talón Resumen ATS - ${m} ${y}`,
  },
  {
    id: "renta_101",
    label: "Formulario 101/102 — Impuesto a la Renta",
    shortLabel: "Form. 101 (Renta)",
    code: "101",
    color: "amber",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Declaración del Impuesto a la Renta anual de sociedades o personas naturales",
    defaultTitleTemplate: (m, y) => `Declaración Impuesto a la Renta - Ejercicio ${y}`,
  },
  {
    id: "retenciones_recibidas",
    label: "Retenciones Recibidas / Comprobantes",
    shortLabel: "Retenciones Clientes",
    code: "RET",
    color: "cyan",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    description: "Comprobantes de retención emitidos por clientes a favor de la empresa",
    defaultTitleTemplate: (m, y) => `Retenciones Recibidas de Clientes - ${m} ${y}`,
  },
  {
    id: "otro",
    label: "Otros Respaldos / Justificativos SRI",
    shortLabel: "Otro Respaldo",
    code: "DOC",
    color: "slate",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Sustitutivas, convenios de pago, resoluciones o anexos adicionales",
    defaultTitleTemplate: (m, y) => `Respaldo Tributario Adicional - ${m} ${y}`,
  },
];

export const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function getCategoryDef(type: string): TaxDocCategoryDef {
  return (
    TAX_DOC_CATEGORIES.find((c) => c.id === type) ?? {
      id: "otro",
      label: type || "Documento",
      shortLabel: type || "Doc",
      code: "DOC",
      color: "slate",
      badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
      description: "Respaldo tributario",
      defaultTitleTemplate: (m, y) => `Documento - ${m} ${y}`,
    }
  );
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
