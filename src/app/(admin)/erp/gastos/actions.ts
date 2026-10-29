"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { assertMonthOpen } from "@/lib/accounting";
import { resolveFacturaSriClave } from "@/lib/expense-areas";
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

    // Al vincular la factura SRI, SIEMPRE tomar de la factura:
    // - Nombre / Razón Social del proveedor
    // - RUC del emisor
    // - Número de factura (comprobante)
    // - N° Autorización / Clave de acceso (49 dígitos)
    const expenseUpdate: Record<string, any> = {
      supplier_name: factura.razon_social?.trim() || expense.supplier_name,
      supplier_ruc: factura.ruc_emisor?.trim() || expense.supplier_ruc,
      document_number: factura.numero_comprobante?.trim() || expense.document_number,
      authorization_number: claveAcceso,
      factura_recibida_clave_acceso: claveAcceso,
      notes,
      updated_at: new Date().toISOString(),
    };

    // Si la factura del SRI tiene valores monetarios, sincronizarlos para evitar discrepancias
    if (Number(factura.total) > 0) {
      const facSubtotal = Number(factura.subtotal) || 0;
      const facIva = Number(factura.iva) || 0;
      const facTotal = Number(factura.total) || 0;

      if (facIva > 0) {
        expenseUpdate.subtotal_15 = facSubtotal;
        expenseUpdate.iva_amount = facIva;
      } else {
        expenseUpdate.subtotal_0 = facSubtotal || facTotal;
        expenseUpdate.iva_amount = 0;
      }
      expenseUpdate.total = facTotal;
    }

    let { error: updateExpErr } = await supabase
      .from("expenses")
      .update(expenseUpdate)
      .eq("id", expenseId);

    // Fallbacks si la tabla expenses no tiene authorization_number o factura_recibida_clave_acceso como columna
    if (updateExpErr && (updateExpErr.message.includes("authorization_number") || updateExpErr.code === "42703")) {
      delete expenseUpdate.authorization_number;
      const retry = await supabase.from("expenses").update(expenseUpdate).eq("id", expenseId);
      updateExpErr = retry.error;
    }

    if (updateExpErr && (updateExpErr.message.includes("factura_recibida_clave_acceso") || updateExpErr.code === "42703")) {
      delete expenseUpdate.factura_recibida_clave_acceso;
      const retry = await supabase.from("expenses").update(expenseUpdate).eq("id", expenseId);
      updateExpErr = retry.error;
    }

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

/**
 * Anula / elimina un gasto y regresa cualquier factura SRI vinculada
 * a su estado original "pendiente" para poder volver a ser registrada.
 */
export async function deleteOrVoidExpense(expenseId: string) {
  try {
    await assertWritePermission("/erp/gastos");
    const supabase = createAdminClient();

    const { data: exp } = await supabase
      .from("expenses")
      .select("id, expense_date, factura_recibida_clave_acceso, authorization_number, notes")
      .eq("id", expenseId)
      .single();

    if (!exp) {
      return { success: false, error: "No se encontró el gasto especificado" };
    }

    if (exp.expense_date) {
      await assertMonthOpen(exp.expense_date);
    }

    // 1. Anular el gasto en la tabla expenses
    const { error: voidErr } = await supabase
      .from("expenses")
      .update({ status: "void" })
      .eq("id", expenseId);

    if (voidErr) {
      return { success: false, error: voidErr.message };
    }

    // 2. Revertir cualquier transacción bancaria generada por este gasto
    try {
      await supabase.from("bank_transactions").delete().eq("expense_id", expenseId);
    } catch (btErr) {
      console.warn("No se pudo revertir transacción bancaria:", btErr);
    }

    // 3. Volver la factura del SRI a estado PENDIENTE de registro
    const clave = resolveFacturaSriClave(exp);
    if (clave) {
      try {
        await supabase
          .from("facturas_recibidas")
          .update({ estado_facop: "pendiente", expense_id: null })
          .eq("clave_acceso", clave);
      } catch (err) {
        console.warn("No se pudo devolver factura a pendiente:", err);
      }
    }

    revalidatePath("/erp/gastos");
    revalidatePath(`/erp/gastos/${expenseId}`);

    return { success: true };
  } catch (err: any) {
    console.error("Error en deleteOrVoidExpense:", err);
    return { success: false, error: err?.message || "Error al anular/eliminar el gasto" };
  }
}
