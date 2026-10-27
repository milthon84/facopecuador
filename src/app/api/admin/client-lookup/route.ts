import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanDocumentNumber } from "@/lib/validators";

/**
 * Busca datos completos de un cliente por cédula o RUC.
 * Prioridad: paciente + facturas previas → solo facturas previas.
 * Prueba cédula exacta Y cédula+001 (RUC persona natural).
 * Si el paciente ya fue facturado, carga los datos de la última factura
 * (razón social, email, teléfono, dirección usados en facturación).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("document");
  const clean = cleanDocumentNumber(raw);
  if (!clean) return NextResponse.json({ found: false });

  const supabase = createAdminClient();

  // Variantes a buscar: exacto + cédula→RUC
  const variants = /^\d{10}$/.test(clean) ? [clean, `${clean}001`] : [clean];

  // ── 1. Buscar paciente en cualquier variante ───────────────────────────────
  let patientId: string | null = null;
  let patientName = "";
  let patientEmail = "";
  let patientPhone = "";

  for (const doc of variants) {
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, email, phone")
      .eq("document_number", doc)
      .maybeSingle();

    if (patient) {
      patientId    = patient.id;
      patientName  = patient.full_name ?? "";
      patientEmail = patient.email     ?? "";
      patientPhone = patient.phone     ?? "";
      break;
    }
  }

  // ── 2. Buscar la factura más reciente en TODAS las variantes ──────────────
  let lastInvoice: {
    client_name: string; client_email: string | null;
    client_phone: string | null; client_address: string | null;
  } | null = null;

  for (const doc of variants) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("client_name, client_email, client_phone, client_address")
      .eq("client_document", doc)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inv) { lastInvoice = inv; break; }
  }

  // ── 3. Si encontramos al paciente ─────────────────────────────────────────
  if (patientId) {
    return NextResponse.json({
      found:      true,
      source:     lastInvoice ? "patient+invoice" : "patient",
      patient_id: patientId,
      // Razón social: usa la de la última factura si existe (puede ser diferente)
      name:    lastInvoice?.client_name  || patientName,
      email:   lastInvoice?.client_email || patientEmail || "",
      phone:   lastInvoice?.client_phone || patientPhone || "",
      address: lastInvoice?.client_address ?? "",
    });
  }

  // ── 4. Solo factura previa (no es paciente registrado) ────────────────────
  if (lastInvoice) {
    return NextResponse.json({
      found:   true,
      source:  "invoice",
      name:    lastInvoice.client_name    ?? "",
      email:   lastInvoice.client_email   ?? "",
      phone:   lastInvoice.client_phone   ?? "",
      address: lastInvoice.client_address ?? "",
    });
  }

  return NextResponse.json({ found: false });
}
