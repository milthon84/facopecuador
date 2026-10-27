export type CoworkingResourceType =
  | "puesto_trabajo"
  | "clinica_completa"
  | "aula_pequena"
  | "aula_grande";

export type CoworkingRentalStatus =
  | "reservado"
  | "en_curso"
  | "finalizado"
  | "facturado"
  | "cancelado";

export interface CoworkingDocumentItem {
  id: string;
  url: string;
  name: string;
  uploaded_at: string;
  size?: number;
}

export interface CoworkingRental {
  id: string;
  resource_type: CoworkingResourceType;
  resource_identifier?: string | null;
  rental_date: string;
  start_time: string;
  end_time: string;
  hours: number;
  status: CoworkingRentalStatus;

  // Datos del doctor
  doctor_name: string;
  doctor_document?: string | null;
  doctor_email?: string | null;
  doctor_phone?: string | null;
  doctor_specialty?: string | null;
  doctor_registration_number?: string | null;
  doctor_id?: string | null;

  // Datos del paciente
  patient_name?: string | null;
  patient_document?: string | null;
  patient_id?: string | null;

  // Documentos
  contract_url?: string | null;
  contract_uploaded_at?: string | null;
  waiver_url?: string | null;
  waiver_uploaded_at?: string | null;

  // Tarifas y Factura
  rate_type: string;
  hourly_rate: number;
  total_price: number;

  // Anticipo
  deposit_amount?: number | null;
  deposit_payment_method?: string | null;
  deposit_notes?: string | null;

  invoice_id?: string | null;
  invoice_number?: string | null;

  notes?: string | null;
  created_by_id?: string | null;
  created_by_email?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const COWORKING_RESOURCES: Record<
  CoworkingResourceType,
  {
    id: CoworkingResourceType;
    name: string;
    shortName: string;
    description: string;
    defaultRate: number; // tarifa sugerida por hora
    badgeColor: string;
    icon: string;
  }
> = {
  puesto_trabajo: {
    id: "puesto_trabajo",
    name: "Puesto de Trabajo (Sillón / Box)",
    shortName: "Puesto Dental",
    description: "Sillón odontológico equipado con instrumental básico para atención clínica individual",
    defaultRate: 20.0,
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200",
    icon: "Stethoscope",
  },
  clinica_completa: {
    id: "clinica_completa",
    name: "Clínica Completa",
    shortName: "Clínica Completa",
    description: "Uso exclusivo de todas las instalaciones clínicas, esterilización y áreas de espera",
    defaultRate: 70.0,
    badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    icon: "Building2",
  },
  aula_pequena: {
    id: "aula_pequena",
    name: "Aula Pequeña (Capacitaciones)",
    shortName: "Aula Pequeña",
    description: "Sala para grupos reducidos (hasta 12 personas) con pantalla interactiva y proyector",
    defaultRate: 25.0,
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
    icon: "Presentation",
  },
  aula_grande: {
    id: "aula_grande",
    name: "Aula Grande (Auditorio)",
    shortName: "Aula Grande",
    description: "Auditorio académico para conferencias, talleres y workshops masivos (hasta 40 personas)",
    defaultRate: 45.0,
    badgeColor: "bg-purple-50 text-purple-800 border-purple-200",
    icon: "GraduationCap",
  },
};

export const COWORKING_STATUS_CONFIG: Record<
  CoworkingRentalStatus,
  {
    label: string;
    badgeCls: string;
    iconName: string;
  }
> = {
  reservado: {
    label: "Reservado",
    badgeCls: "bg-blue-50 text-blue-800 border-blue-200",
    iconName: "Calendar",
  },
  en_curso: {
    label: "En Curso",
    badgeCls: "bg-amber-50 text-amber-800 border-amber-200 animate-pulse",
    iconName: "PlayCircle",
  },
  finalizado: {
    label: "Atención Finalizada",
    badgeCls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    iconName: "CheckCircle",
  },
  facturado: {
    label: "Facturado SRI",
    badgeCls: "bg-teal-100 text-teal-900 border-teal-300 font-bold",
    iconName: "FileCheck",
  },
  cancelado: {
    label: "Cancelado",
    badgeCls: "bg-red-50 text-red-700 border-red-200",
    iconName: "XCircle",
  },
};

export function calculateHoursBetween(start: string, end: string): number {
  if (!start || !end) return 1.0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = (sh || 0) * 60 + (sm || 0);
  const endMin = (eh || 0) * 60 + (em || 0);
  const diffMin = Math.max(endMin - startMin, 30);
  return Math.round((diffMin / 60) * 100) / 100;
}

/**
 * Parsea documentos desde el campo de texto (soporta URL única heredada o array JSON de documentos).
 */
export function parseCoworkingDocuments(
  rawUrl: string | null | undefined,
  defaultNamePrefix = "Documento",
  fallbackDate?: string | null
): CoworkingDocumentItem[] {
  if (!rawUrl || typeof rawUrl !== "string") return [];
  const trimmed = rawUrl.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && (typeof item === "string" || item.url))
          .map((item, idx) => {
            if (typeof item === "string") {
              return {
                id: String(idx + 1),
                url: item,
                name: `${defaultNamePrefix} ${idx + 1}`,
                uploaded_at: fallbackDate || new Date().toISOString(),
              };
            }
            return {
              id: item.id || String(idx + 1),
              url: item.url,
              name: item.name || `${defaultNamePrefix} ${idx + 1}`,
              uploaded_at: item.uploaded_at || fallbackDate || new Date().toISOString(),
              size: item.size,
            };
          });
      } else if (parsed && typeof parsed === "object" && parsed.url) {
        return [
          {
            id: parsed.id || "1",
            url: parsed.url,
            name: parsed.name || defaultNamePrefix,
            uploaded_at: parsed.uploaded_at || fallbackDate || new Date().toISOString(),
            size: parsed.size,
          },
        ];
      }
    } catch {
      // Fallback a URL regular si falla el parse
    }
  }

  // URL regular (Supabase Storage o HTTP)
  return [
    {
      id: "1",
      url: trimmed,
      name: defaultNamePrefix,
      uploaded_at: fallbackDate || new Date().toISOString(),
    },
  ];
}

/**
 * Serializa la lista de documentos para guardarla en el campo contract_url o waiver_url.
 */
export function serializeCoworkingDocuments(docs: CoworkingDocumentItem[]): string | null {
  if (!docs || docs.length === 0) return null;
  return JSON.stringify(docs);
}

/**
 * Verifica si hay al menos un documento válido cargado.
 */
export function hasCoworkingDocuments(rawUrl: string | null | undefined): boolean {
  return parseCoworkingDocuments(rawUrl).length > 0;
}
