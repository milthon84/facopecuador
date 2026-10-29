export interface ResponsableCajaChica {
  nombre: string;
  identificacion: string;
  banco: string;
  cuenta: string;
  tipo_cuenta?: string;
  telefono?: string;
}

/**
 * Parsea los datos del custodio/responsable de caja chica desde el campo notes de bank_accounts.
 * Formato persistido: [RESPONSABLE:{"nombre":"...","identificacion":"...","banco":"...","cuenta":"..."}]
 */
export function parseResponsableCajaChica(notes: string | null | undefined): ResponsableCajaChica | null {
  if (!notes) return null;
  const match = notes.match(/\[RESPONSABLE:(\{.*?\})\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.nombre === "string" && parsed.nombre.trim().length > 0) {
        return {
          nombre: parsed.nombre.trim(),
          identificacion: (parsed.identificacion || "").trim(),
          banco: (parsed.banco || "").trim(),
          cuenta: (parsed.cuenta || "").trim(),
          tipo_cuenta: parsed.tipo_cuenta || "Ahorros",
          telefono: (parsed.telefono || "").trim(),
        };
      }
    } catch {
      // Formato no válido
    }
  }
  return null;
}

/**
 * Agrega o reemplaza la etiqueta [RESPONSABLE:...] en el campo notes preservando otras notas.
 */
export function formatResponsableNotes(
  currentNotes: string | null | undefined,
  responsable: ResponsableCajaChica | null
): string {
  const clean = (currentNotes || "")
    .replace(/\[RESPONSABLE:\{.*?\}\]/g, "")
    .trim();

  if (!responsable || !responsable.nombre.trim()) {
    return clean;
  }

  const tag = `[RESPONSABLE:${JSON.stringify(responsable)}]`;
  return clean ? `${clean} ${tag}` : tag;
}
