import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarAutorizacion } from "@/lib/sri-wsdl";
import { createCreditNoteJournalEntry } from "@/lib/accounting";
import { getSessionUser } from "@/lib/supabase/auth";
import { logAudit } from "@/lib/audit";

/**
 * Consulta y sincroniza el estado de una Nota de Crédito directamente con el SRI.
 * POST /api/admin/nota-credito-sync { credit_note_id }
 */
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const user = await getSessionUser(req);

    const body = await req.json();
    const { credit_note_id } = body;
    if (!credit_note_id) {
      return NextResponse.json({ error: "credit_note_id requerido" }, { status: 400 });
    }

    // 1. Obtener datos de la nota de crédito
    const { data: cn, error: cnError } = await supabase
      .from("credit_notes")
      .select("*, invoices(*)")
      .eq("id", credit_note_id)
      .single();

    if (cnError || !cn) {
      return NextResponse.json({ error: "Nota de Crédito no encontrada" }, { status: 404 });
    }

    if (!cn.sri_access_key) {
      return NextResponse.json({ error: "La Nota de Crédito no posee clave de acceso" }, { status: 400 });
    }

    const ambiente = (cn.sri_environment || "1") as "1" | "2";

    // 2. Consultar autorización al SRI
    const autorizacion = await consultarAutorizacion(cn.sri_access_key, ambiente);

    let nuevo_estado = cn.sri_status;
    let numero_autorizacion: string | null = cn.sri_authorization_number;
    let fecha_autorizacion: string | null = cn.sri_authorization_date;
    let mensajes: any = cn.sri_error_messages;

    if (autorizacion.estado === "AUTORIZADO") {
      nuevo_estado = "authorized";
      numero_autorizacion = autorizacion.numeroAutorizacion || cn.sri_access_key;
      fecha_autorizacion = autorizacion.fechaAutorizacion || new Date().toISOString();
      mensajes = null;

      // Actualizar Factura original
      if (cn.invoice_id) {
        const inv = cn.invoices;
        const existingMsg = (inv?.sri_error_messages as Record<string, any>) || {};
        await supabase
          .from("invoices")
          .update({
            payment_status: "cancelled",
            sri_error_messages: {
              ...existingMsg,
              credit_note: {
                credit_note_id: cn.id,
                credit_note_number: cn.credit_note_number,
                motivo: cn.motivo,
                authorized_at: fecha_autorizacion,
              },
            },
          })
          .eq("id", cn.invoice_id);
      }

      // Reversión contable en el Libro Diario
      try {
        await createCreditNoteJournalEntry({
          credit_note_id: cn.id,
          credit_note_number: cn.credit_note_number,
          credit_note_date: cn.issue_date || new Date().toISOString().split("T")[0],
          invoice_number: cn.num_doc_modificado,
          client_name: cn.client_name,
          subtotal_0: Number(cn.subtotal_0 || 0),
          subtotal_15: Number(cn.subtotal_15 || 0),
          iva_amount: Number(cn.iva_amount || 0),
          total: Number(cn.total || 0),
          motivo: cn.motivo || "Anulación de comprobante de venta",
          user_id: user?.id,
          user_email: user?.email,
        });
      } catch (accErr) {
        console.warn("Advertencia: No se pudo generar asiento contable en sincronización:", accErr);
      }
    } else if (autorizacion.estado === "EN PROCESO") {
      nuevo_estado = "submitted";
      mensajes = autorizacion.mensajes || null;
    } else if (autorizacion.estado === "NO AUTORIZADO") {
      nuevo_estado = "rejected";
      mensajes = autorizacion.mensajes || null;
    }

    // 3. Actualizar la Nota de Crédito en DB
    await supabase
      .from("credit_notes")
      .update({
        sri_status: nuevo_estado,
        sri_authorization_number: numero_autorizacion,
        sri_authorization_date: fecha_autorizacion,
        sri_error_messages: mensajes,
      })
      .eq("id", credit_note_id);

    if (user) {
      await logAudit({
        user_id: user.id,
        user_email: user.email,
        user_role: (user.app_metadata?.role as any) || "admin",
        action: "update",
        resource: "credit_note",
        resource_id: credit_note_id,
        description: `Sincronización SRI para Nota de Crédito ${cn.credit_note_number}: ${nuevo_estado}`,
      });
    }

    return NextResponse.json({
      success: true,
      estado: nuevo_estado,
      numero_autorizacion,
      fecha_autorizacion,
      mensajes,
      autorizacion,
    });
  } catch (err: any) {
    console.error("Error en /api/admin/nota-credito-sync:", err);
    return NextResponse.json({ error: err.message || "Error al sincronizar con SRI" }, { status: 500 });
  }
}
