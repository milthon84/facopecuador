import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarAutorizacion } from "@/lib/sri-wsdl";
import { syncInvoiceJournalEntries } from "@/lib/accounting";

/**
 * Reintenta la consulta de autorización para una factura en estado "submitted".
 * POST /api/admin/sri-reintento { invoice_id }
 */
export async function POST(req: Request) {
  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) return NextResponse.json({ error: "invoice_id requerido" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: invoice } = await supabase
      .from("invoices")
      .select("sri_access_key, sri_environment, sri_status")
      .eq("id", invoice_id)
      .single();

    if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    if (invoice.sri_status !== "submitted") {
      return NextResponse.json({ error: "La factura no está en estado 'submitted'" }, { status: 400 });
    }

    // Consultar al SRI
    const autorizacion = await consultarAutorizacion(
      invoice.sri_access_key,
      (invoice.sri_environment || "1") as "1" | "2"
    );

    let nuevo_estado = "submitted";
    let numero_autorizacion: string | null = null;
    let fecha_autorizacion: string | null = null;
    let mensajes: object | null = null;

    if (autorizacion.estado === "AUTORIZADO") {
      nuevo_estado     = "authorized";
      numero_autorizacion = autorizacion.numeroAutorizacion ?? invoice.sri_access_key;
      fecha_autorizacion  = autorizacion.fechaAutorizacion  ?? new Date().toISOString();
    } else if (autorizacion.estado === "NO AUTORIZADO") {
      nuevo_estado = "rejected";
      mensajes     = autorizacion.mensajes ?? null;
    }

    // Actualizar en DB
    await supabase.from("invoices").update({
      sri_status:               nuevo_estado,
      ...(numero_autorizacion ? { sri_authorization_number: numero_autorizacion } : {}),
      ...(fecha_autorizacion  ? { sri_authorization_date:   fecha_autorizacion  } : {}),
      ...(mensajes            ? { sri_error_messages:       mensajes            } : {}),
    }).eq("id", invoice_id);

    if (nuevo_estado === "authorized") {
      try {
        await syncInvoiceJournalEntries(invoice_id);
      } catch (jErr) {
        console.warn("No se pudo auto-sincronizar asiento de factura autorizada:", jErr);
      }
    }

    return NextResponse.json({ estado: nuevo_estado, autorizacion });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
