import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/supabase/auth";
import { logAudit } from "@/lib/audit";
import { assertMonthOpen } from "@/lib/accounting";

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Verificación de sesión y permisos
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    if (role !== "admin") {
      const { data } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role);
      const paths = (data || []).map((p: any) => p.path);
      if (!paths.includes("/erp/facturacion/modificar")) {
        return NextResponse.json({ error: "Sin permisos de facturación" }, { status: 403 });
      }
    }

    const body = await req.json();
    const { invoice_id, force = false } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "ID de factura requerido" }, { status: 400 });
    }

    // 2. Obtener la factura
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Validar que el mes de la factura no se encuentre cerrado
    const issueDate = invoice.created_at ? invoice.created_at.split("T")[0] : new Date().toISOString().split("T")[0];
    try {
      await assertMonthOpen(issueDate);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    if (invoice.sri_status === "cancelled") {
      return NextResponse.json({ error: "La factura ya se encuentra anulada" }, { status: 400 });
    }

    // 3. Validar condiciones del SRI si la factura fue autorizada o enviada
    const isSriValid = invoice.sri_status === "authorized" || invoice.sri_status === "submitted";
    if (isSriValid) {
      // Regla 1: Consumidor Final no se puede anular
      if (invoice.client_document === "9999999999999") {
        return NextResponse.json(
          { error: "El SRI no permite anular ni modificar facturas autorizadas a Consumidor Final (9999999999999)." },
          { status: 400 }
        );
      }

      // Regla 2: Plazo del día 9 del mes siguiente
      const [year, month, day] = invoice.issue_date.split("-").map(Number);
      // El mes de emisión es month (1-indexed), en JS es month-1.
      // El día 9 del mes siguiente (month) a las 23:59:59.
      const limitDate = new Date(year, month, 9, 23, 59, 59, 999);
      const now = new Date();

      if (now > limitDate && !force) {
        // Formatear fecha límite en español
        const months = [
          "enero", "febrero", "marzo", "abril", "mayo", "junio",
          "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
        ];
        const formattedDeadline = `9 de ${months[month]} de ${year}`;
        return NextResponse.json(
          {
            error: "deadline_passed",
            message: `El plazo legal del SRI para anular esta factura en línea venció el ${formattedDeadline}. Fuera de este plazo, el SRI exige la emisión de una Nota de Crédito.`,
            deadline: formattedDeadline
          },
          { status: 400 }
        );
      }
    }

    // 4. Procesar la anulación en la base de datos
    // - Actualizar factura
    const updatedMessages = {
      ...(invoice.sri_error_messages as Record<string, any> || {}),
      annulment: {
        annulled_at: new Date().toISOString(),
        annulled_by: user.email,
        original_status: invoice.sri_status,
        original_payment_status: invoice.payment_status,
      }
    };

    let { error: updateInvError } = await supabase
      .from("invoices")
      .update({
        sri_status: "cancelled",
        payment_status: "cancelled",
        sri_error_messages: updatedMessages
      })
      .eq("id", invoice_id);

    // Fallback de resiliencia si la restricción CHECK de Supabase no permite 'cancelled' en payment_status
    if (updateInvError && (updateInvError.message.includes("payment_status") || updateInvError.message.includes("check"))) {
      const { error: fallbackError } = await supabase
        .from("invoices")
        .update({
          sri_status: "cancelled",
          payment_status: "pending",
          sri_error_messages: updatedMessages
        })
        .eq("id", invoice_id);

      updateInvError = fallbackError;
    }

    if (updateInvError) {
      throw new Error(`Error al actualizar factura: ${updateInvError.message}`);
    }

    // - Actualizar curso_modulo_inscripciones
    const { error: updateModulesError } = await supabase
      .from("curso_modulo_inscripciones")
      .update({
        billing_status: "pending",
        invoice_id: null
      })
      .eq("invoice_id", invoice_id);

    if (updateModulesError) {
      console.error("Error liberando inscripciones de módulos:", updateModulesError);
    }

    // - Eliminar pagos en invoice_payments
    const { error: deletePaymentsError } = await supabase
      .from("invoice_payments")
      .delete()
      .eq("invoice_id", invoice_id);

    if (deletePaymentsError) {
      console.error("Error eliminando pagos asociados:", deletePaymentsError);
    }

    // - Eliminar transacciones de caja/bancos en bank_transactions
    const { error: deleteTransactionsError } = await supabase
      .from("bank_transactions")
      .delete()
      .eq("invoice_id", invoice_id);

    if (deleteTransactionsError) {
      console.error("Error eliminando transacciones bancarias:", deleteTransactionsError);
    }

    // - Anular asientos contables
    const { error: updateJournalError } = await supabase
      .from("journal_entries")
      .update({ status: "void" })
      .eq("reference_type", "invoice")
      .eq("reference_id", invoice_id);

    if (updateJournalError) {
      console.error("Error anulando asientos contables:", updateJournalError);
    }

    // 5. Registrar logs de auditoría
    await logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: role,
      action: "cancel",
      resource: "invoice",
      resource_id: invoice_id,
      description: `Factura ${invoice.invoice_number || 'Borrador'} (${invoice.sri_access_key}) anulada localmente.`,
      metadata: { force, isSriValid }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Error en anulación de factura:", error);
    return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
  }
}
