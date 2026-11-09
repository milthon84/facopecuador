"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, createExpensePaymentJournalEntry } from "@/lib/accounting";
import { resolveFacturaSriClave, cleanDocNumberOnly } from "@/lib/expense-areas";
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

    // 3. Actualizar notas para incluir la clave y tipo factura si no los tiene
    let notes = expense.notes || "";
    if (!notes.includes("[FACTURA_SRI:")) {
      notes = notes ? `${notes} [FACTURA_SRI:${claveAcceso}]` : `[FACTURA_SRI:${claveAcceso}]`;
    }
    if (notes.includes("[TIPO:")) {
      notes = notes.replace(/\[TIPO:[^\]]+\]/gi, "[TIPO:factura]");
    } else {
      notes = `${notes} [TIPO:factura]`;
    }

    // Al vincular la factura SRI, SIEMPRE tomar de la factura:
    // - Nombre / Razón Social del proveedor
    // - RUC del emisor
    // - Número de factura limpio (sin palabra "Factura")
    // - N° Autorización / Clave de acceso (49 dígitos)
    const cleanNum = cleanDocNumberOnly(factura.numero_comprobante) || cleanDocNumberOnly(expense.document_number) || null;

    const expenseUpdate: Record<string, any> = {
      supplier_name: factura.razon_social?.trim() || expense.supplier_name,
      supplier_ruc: factura.ruc_emisor?.trim() || expense.supplier_ruc,
      document_number: cleanNum,
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

/**
 * Consulta la cuenta contable predeterminada o habitual de un proveedor según su RUC
 */
export async function lookupSupplierAccountAction(ruc: string) {
  try {
    const { getSupplierDefaultAccount } = await import("@/lib/expense-accounts-server");
    const accountInfo = await getSupplierDefaultAccount(ruc);
    return { success: true, data: accountInfo };
  } catch (err: any) {
    console.error("Error en lookupSupplierAccountAction:", err);
    return { success: false, error: err?.message || "Error al consultar proveedor" };
  }
}

/**
 * Registra la forma de pago (Paso 2) de un gasto y realiza el cruce contable con Bancos o Caja Chica:
 * Débito: Cuentas por Pagar Proveedores (2.1.01.01)
 * Crédito: Bancos (1.1.01.03) o Caja Chica (1.1.01.02)
 */
export async function recordExpensePaymentAction(params: {
  expense_id: string;
  payment_method: string;
  bank_account_id?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  card_type?: string | null;
  card_lote?: string | null;
  card_voucher?: string | null;
}) {
  try {
    await assertWritePermission("/erp/gastos");
    const supabase = createAdminClient();

    // 1. Obtener el gasto existente
    const { data: expense, error: expErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", params.expense_id)
      .single();

    if (expErr || !expense) {
      return { success: false, error: "No se encontró el gasto para registrar el pago." };
    }

    const payDate = params.payment_date || expense.expense_date || new Date().toISOString().split("T")[0];
    await assertMonthOpen(payDate);

    // Preparar notas si viene tarjeta
    let updatedNotes = expense.notes || "";
    if (params.payment_method === "tarjeta_credito" && (params.card_type || params.card_lote || params.card_voucher)) {
      const cardStr = `[TARJETA:${params.card_type || ""} LOTE:${params.card_lote || ""} VOUCHER:${params.card_voucher || ""}]`;
      if (!updatedNotes.includes("[TARJETA:")) {
        updatedNotes = updatedNotes ? `${updatedNotes} ${cardStr}` : cardStr;
      }
    }

    // Obtener datos del banco / caja
    let bankName: string | null = null;
    if (params.bank_account_id) {
      const { data: bAcc } = await supabase
        .from("bank_accounts")
        .select("bank_name, account_number")
        .eq("id", params.bank_account_id)
        .maybeSingle();
      if (bAcc) {
        bankName = `${bAcc.bank_name}${bAcc.account_number ? ` (${bAcc.account_number})` : ""}`;
      }
    }

    // 2. Actualizar el gasto con la forma de pago y cuenta
    const { error: updateErr } = await supabase
      .from("expenses")
      .update({
        payment_method: params.payment_method,
        bank_account_id: params.bank_account_id || null,
        payment_reference: params.payment_reference || null,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.expense_id);

    if (updateErr) {
      console.warn("Error actualizando forma de pago en gasto:", updateErr);
    }

    // 3. Registrar egreso en bank_transactions si tiene cuenta bancaria/caja
    if (params.bank_account_id) {
      try {
        await supabase.from("bank_transactions").insert({
          account_id: params.bank_account_id,
          type: "egreso",
          amount: expense.total,
          date: payDate,
          description: `Pago compra: ${expense.supplier_name}`,
          reference: params.payment_reference || null,
          payment_method: params.payment_method,
          expense_id: expense.id,
          status: "confirmado",
          origin: "automatico",
        });
      } catch (bankErr) {
        console.warn("No se pudo registrar egreso en bank_transactions:", bankErr);
      }
    }

    // 4. Asiento 2 de Cruce Contable con Bancos / Caja Chica
    try {
      await createExpensePaymentJournalEntry({
        expense_id: expense.id,
        payment_date: payDate,
        supplier_name: expense.supplier_name,
        payment_method: params.payment_method,
        amount: Number(expense.total) || 0,
        bank_account_name: bankName,
        payment_reference: params.payment_reference,
      });
    } catch (jErr) {
      console.warn("No se pudo registrar el asiento de cruce bancario:", jErr);
    }

    revalidatePath("/erp/gastos");
    revalidatePath(`/erp/gastos/${params.expense_id}`);

    return { success: true, url: `/erp/gastos/${params.expense_id}` };
  } catch (err: any) {
    console.error("Error en recordExpensePaymentAction:", err);
    return { success: false, error: err?.message || "Error al registrar el pago del gasto" };
  }
}
