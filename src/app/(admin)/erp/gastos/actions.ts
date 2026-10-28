"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { revalidatePath } from "next/cache";

export async function linkExpenseToFactura(expenseId: string, claveAcceso: string) {
  try {
    await assertWritePermission("/erp/gastos");
    const supabase = createAdminClient();

    // 1. Obtener la factura recibida del SRI
    const { data: factura, error: facErr } = await supabase
      .from("facturas_recibidas")
      .select("*")
      .eq("clave_acceso", claveAcceso)
      .single();

    if (facErr || !factura) {
      return { success: false, error: "No se encontró la factura electrónica seleccionada" };
    }

    // 2. Obtener el gasto actual
    const { data: expense, error: expErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .single();

    if (expErr || !expense) {
      return { success: false, error: "No se encontró el gasto especificado" };
    }

    // 3. Actualizar notas para incluir la clave si no la tiene
    let notes = expense.notes || "";
    if (!notes.includes("[FACTURA_SRI:")) {
      notes = notes ? `${notes} [FACTURA_SRI:${claveAcceso}]` : `[FACTURA_SRI:${claveAcceso}]`;
    }

    const expenseUpdate: Record<string, any> = {
      factura_recibida_clave_acceso: claveAcceso,
      notes,
      updated_at: new Date().toISOString(),
    };

    // Si el gasto no tenía número de comprobante o RUC, completarlo con los datos del SRI
    if (!expense.document_number && factura.numero_comprobante) {
      expenseUpdate.document_number = factura.numero_comprobante;
    }
    if (!expense.supplier_ruc && factura.ruc_emisor) {
      expenseUpdate.supplier_ruc = factura.ruc_emisor;
    }

    const { error: updateExpErr } = await supabase
      .from("expenses")
      .update(expenseUpdate)
      .eq("id", expenseId);

    if (updateExpErr) {
      return { success: false, error: updateExpErr.message };
    }

    // 4. Actualizar facturas_recibidas para marcarla como registrada
    const { error: updateFacErr } = await supabase
      .from("facturas_recibidas")
      .update({
        estado_facop: "registrado",
        expense_id: expenseId,
      })
      .eq("clave_acceso", claveAcceso);

    if (updateFacErr && (updateFacErr.message.includes("expense_id") || updateFacErr.code === "42703")) {
      await supabase
        .from("facturas_recibidas")
        .update({ estado_facop: "registrado" })
        .eq("clave_acceso", claveAcceso);
    }

    revalidatePath("/erp/gastos");
    revalidatePath(`/erp/gastos/${expenseId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error en linkExpenseToFactura:", err);
    return { success: false, error: err?.message || "Error al relacionar la factura" };
  }
}

export async function unlinkExpenseFromFactura(expenseId: string, claveAcceso: string) {
  try {
    await assertWritePermission("/erp/gastos");
    const supabase = createAdminClient();

    // 1. Desvincular en expenses
    const { data: expense } = await supabase
      .from("expenses")
      .select("notes")
      .eq("id", expenseId)
      .single();

    let cleanNotes = expense?.notes || "";
    cleanNotes = cleanNotes.replace(/\[FACTURA_SRI:[^\]]+\]/g, "").trim();

    await supabase
      .from("expenses")
      .update({
        factura_recibida_clave_acceso: null,
        notes: cleanNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expenseId);

    // 2. Regresar factura a estado pendiente
    await supabase
      .from("facturas_recibidas")
      .update({
        estado_facop: "pendiente",
        expense_id: null,
      })
      .eq("clave_acceso", claveAcceso);

    revalidatePath("/erp/gastos");
    revalidatePath(`/erp/gastos/${expenseId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error en unlinkExpenseFromFactura:", err);
    return { success: false, error: err?.message || "Error al desvincular la factura" };
  }
}
