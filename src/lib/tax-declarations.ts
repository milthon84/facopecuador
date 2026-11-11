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
  | "supercias_balances"
  | "supercias_actas"
  | "supercias_socios"
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
    label: "Comprobante de Pago SRI / Débito (CEP)",
    shortLabel: "Pago SRI / CEP",
    code: "CEP",
    color: "amber",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Comprobante Electrónico de Pago (CEP), convenio de débito o papeleta bancaria",
    defaultTitleTemplate: (m, y) => `Comprobante de Pago SRI - ${m} ${y}`,
  },
  {
    id: "renta_101",
    label: "Formulario 101 — Impuesto a la Renta Sociedades (SRI)",
    shortLabel: "Form. 101 (Renta)",
    code: "101",
    color: "rose",
    badgeColor: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Declaración anual del Impuesto a la Renta de Sociedades (SRI)",
    defaultTitleTemplate: (m, y) => `Declaración Renta Form. 101 - Ejercicio ${y}`,
  },
  {
    id: "supercias_balances",
    label: "SuperCias — Balances y Estados Financieros NIIF",
    shortLabel: "Balances SuperCias",
    code: "BAL",
    color: "indigo",
    badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Juegos completos de Estados Financieros NIIF presentados a la SuperCias",
    defaultTitleTemplate: (m, y) => `Estados Financieros SuperCias - Ejercicio ${y}`,
  },
  {
    id: "supercias_actas",
    label: "SuperCias — Informes y Acta de Junta General",
    shortLabel: "Informes y Actas",
    code: "ACTA",
    color: "orange",
    badgeColor: "bg-orange-50 text-orange-800 border-orange-200",
    description: "Informe de Gerente, Comisario y Acta de Junta de Aprobación de Balances",
    defaultTitleTemplate: (m, y) => `Informes y Acta de Junta - Ejercicio ${y}`,
  },
  {
    id: "supercias_socios",
    label: "SuperCias — Nómina de Socios y Accionistas",
    shortLabel: "Nómina de Socios",
    code: "SOC",
    color: "teal",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
    description: "Nómina de socios / accionistas y beneficiarios finales reportados a la SuperCias",
    defaultTitleTemplate: (m, y) => `Nómina de Socios SuperCias - Ejercicio ${y}`,
  },
  {
    id: "otro",
    label: "Otros Respaldos / Retenciones / Justificativos SRI",
    shortLabel: "Otros / Retenciones",
    code: "DOC",
    color: "slate",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Retenciones de clientes, resoluciones, convenios de pago o justificativos adicionales",
    defaultTitleTemplate: (m, y) => `Respaldo / Retención Adicional - ${m} ${y}`,
  },
  {
    id: "retenciones_recibidas",
    label: "Retenciones Recibidas (Clientes)",
    shortLabel: "Retenciones",
    code: "RET",
    color: "slate",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-300",
    description: "Comprobantes de retención emitidos por clientes",
    defaultTitleTemplate: (m, y) => `Retención de Cliente - ${m} ${y}`,
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

export function detectTaxDocType(filename: string): TaxDocType {
  const lower = (filename || "").toLowerCase();
  if (lower.includes("104") || lower.includes("iva")) return "iva_104";
  if (lower.includes("ats") || lower.includes("anexo") || lower.endsWith(".xml")) return "ats";
  if (lower.includes("103") || lower.includes("ret_fuente") || lower.includes("fuente")) return "retenciones_103";
  if (lower.includes("cep") || lower.includes("ceep") || lower.includes("pago") || lower.includes("debito") || lower.includes("banco") || lower.includes("comprobante_pago") || lower.includes("comprobante-pago") || lower.includes("pago_sri")) return "pago_sri";
  if (lower.includes("101") || lower.includes("renta_sociedad") || lower.includes("renta")) return "renta_101";
  if (lower.includes("supercia") || lower.includes("balance") || lower.includes("eeff") || lower.includes("financiero")) return "supercias_balances";
  if (lower.includes("acta") || lower.includes("informe_gerente") || lower.includes("informe_comisario") || lower.includes("junta")) return "supercias_actas";
  if (lower.includes("socio") || lower.includes("accionista") || lower.includes("nomina")) return "supercias_socios";
  // "y otros retenciones que se carge en otros" -> retenciones se cargan en otros
  return "otro";
}
