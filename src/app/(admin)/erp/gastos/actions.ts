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
      .select("id, expense_date, factura_recibida_clave_acceso, notes")
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
 * Permite adjuntar el comprobante de pago (transferencia/voucher) de manera independiente.
 */
export async function recordExpensePaymentAction(paramsOrFormData: FormData | {
  expense_id: string;
  payment_method: string;
  bank_account_id?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  card_type?: string | null;
  card_lote?: string | null;
  card_voucher?: string | null;
  payment_receipt_url?: string | null;
}) {
  try {
    await assertWritePermission("/erp/gastos");
    const supabase = createAdminClient();

    let expense_id: string;
    let payment_method: string;
    let bank_account_id: string | null = null;
    let payment_reference: string | null = null;
    let payment_date: string | null = null;
    let card_type: string | null = null;
    let card_lote: string | null = null;
    let card_voucher: string | null = null;
    let paymentReceiptUrl: string | null = null;
    let paymentFile: File | null = null;

    if (paramsOrFormData instanceof FormData) {
      expense_id = (paramsOrFormData.get("expense_id") as string) || "";
      payment_method = (paramsOrFormData.get("payment_method") as string) || "transferencia";
      bank_account_id = (paramsOrFormData.get("bank_account_id") as string) || null;
      payment_reference = (paramsOrFormData.get("payment_reference") as string) || null;
      payment_date = (paramsOrFormData.get("payment_date") as string) || null;
      card_type = (paramsOrFormData.get("card_type") as string) || null;
      card_lote = (paramsOrFormData.get("card_lote") as string) || null;
      card_voucher = (paramsOrFormData.get("card_voucher") as string) || null;
      paymentReceiptUrl = (paramsOrFormData.get("payment_receipt_url") as string) || null;
      paymentFile = paramsOrFormData.get("payment_receipt_file") as File | null;
    } else {
      expense_id = paramsOrFormData.expense_id;
      payment_method = paramsOrFormData.payment_method;
      bank_account_id = paramsOrFormData.bank_account_id || null;
      payment_reference = paramsOrFormData.payment_reference || null;
      payment_date = paramsOrFormData.payment_date || null;
      card_type = paramsOrFormData.card_type || null;
      card_lote = paramsOrFormData.card_lote || null;
      card_voucher = paramsOrFormData.card_voucher || null;
      paymentReceiptUrl = paramsOrFormData.payment_receipt_url || null;
    }

    if (!expense_id) {
      return { success: false, error: "ID de gasto no proporcionado." };
    }

    // 1. Obtener el gasto existente
    const { data: expense, error: expErr } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expense_id)
      .single();

    if (expErr || !expense) {
      return { success: false, error: "No se encontró el gasto para registrar el pago." };
    }

    const payDate = payment_date || expense.expense_date || new Date().toISOString().split("T")[0];
    await assertMonthOpen(payDate);

    // 2. Procesar archivo de comprobante de pago si fue adjuntado
    if (paymentFile && paymentFile.size > 0) {
      try {
        const rawBytes = Buffer.from(await paymentFile.arrayBuffer());
        let uploadBuffer: Buffer = rawBytes;
        let contentType = paymentFile.type || "application/octet-stream";
        let fileExt = paymentFile.name.split(".").pop()?.toLowerCase() || "pdf";

        if (contentType.startsWith("image/")) {
          try {
            const { optimizeImageForWeb } = await import("@/lib/image-optimizer");
            const optimized = await optimizeImageForWeb(rawBytes, {
              maxWidth: 1600,
              maxHeight: 1600,
              quality: 82,
              format: "webp",
            });
            uploadBuffer = optimized.buffer;
            contentType = optimized.contentType;
            fileExt = optimized.extension;
          } catch (optErr) {
            console.warn("No se pudo optimizar imagen de comprobante de pago:", optErr);
          }
        }

        const timestamp = Date.now();
        const safeName = paymentFile.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 30);
        const fileName = `pagos/${timestamp}_${safeName}.${fileExt}`;

        try {
          const { data: bInfo } = await supabase.storage.getBucket("payment-proofs");
          if (!bInfo) {
            await supabase.storage.createBucket("payment-proofs", { public: true });
          } else if (!bInfo.public) {
            await supabase.storage.updateBucket("payment-proofs", { public: true });
          }
        } catch (bErr) {
          console.warn("Error asegurando bucket payment-proofs para pago:", bErr);
        }

        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(fileName, uploadBuffer, {
            contentType,
            cacheControl: "31536000",
            upsert: true,
          });

        if (!uploadError) {
          try {
            const { warmLocalStorageCache } = await import("@/lib/storage-cache-server");
            await warmLocalStorageCache("payment-proofs", fileName, uploadBuffer);
          } catch {
            // Cache opcional
          }
          const { data: urlData } = supabase.storage.from("payment-proofs").getPublicUrl(fileName);
          paymentReceiptUrl = urlData?.publicUrl || null;
        } else {
          console.error("Error al subir archivo de comprobante de pago:", uploadError);
        }
      } catch (fileErr) {
        console.error("Error procesando archivo de comprobante de pago:", fileErr);
      }
    }

    // Preparar notas si viene tarjeta o comprobante de pago
    let updatedNotes = expense.notes || "";
    if (payment_method === "tarjeta_credito" && (card_type || card_lote || card_voucher)) {
      const cardStr = `[TARJETA:${card_type || ""} LOTE:${card_lote || ""} VOUCHER:${card_voucher || ""}]`;
      if (!updatedNotes.includes("[TARJETA:")) {
        updatedNotes = updatedNotes ? `${updatedNotes} ${cardStr}` : cardStr;
      }
    }

    if (paymentReceiptUrl) {
      // Reemplazar comprobante de pago previo si existía
      updatedNotes = updatedNotes.replace(/\[COMPROBANTE_PAGO:[^\]]+\]/gi, "").trim();
      updatedNotes = updatedNotes ? `${updatedNotes} [COMPROBANTE_PAGO:${paymentReceiptUrl}]` : `[COMPROBANTE_PAGO:${paymentReceiptUrl}]`;
    }

    // Obtener datos del banco / caja
    let bankName: string | null = null;
    if (bank_account_id) {
      const { data: bAcc } = await supabase
        .from("bank_accounts")
        .select("bank_name, account_number")
        .eq("id", bank_account_id)
        .maybeSingle();
      if (bAcc) {
        bankName = `${bAcc.bank_name}${bAcc.account_number ? ` (${bAcc.account_number})` : ""}`;
      }
    }

    // 3. Actualizar el gasto con la forma de pago, cuenta y notas
    const { error: updateErr } = await supabase
      .from("expenses")
      .update({
        payment_method,
        bank_account_id: bank_account_id || null,
        payment_reference: payment_reference || null,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expense_id);

    if (updateErr) {
      console.warn("Error actualizando forma de pago en gasto:", updateErr);
    }

    // 4. Registrar egreso en bank_transactions si tiene cuenta bancaria/caja
    if (bank_account_id) {
      try {
        await supabase.from("bank_transactions").insert({
          account_id: bank_account_id,
          type: "egreso",
          amount: expense.total,
          date: payDate,
          description: `Pago compra: ${expense.supplier_name}`,
          reference: payment_reference || null,
          payment_method,
          expense_id: expense.id,
          status: "confirmado",
          origin: "automatico",
        });
      } catch (bankErr) {
        console.warn("No se pudo registrar egreso en bank_transactions:", bankErr);
      }
    }

    // 5. Asiento 2 de Cruce Contable con Bancos / Caja Chica
    try {
      await createExpensePaymentJournalEntry({
        expense_id: expense.id,
        payment_date: payDate,
        supplier_name: expense.supplier_name,
        payment_method,
        amount: Number(expense.total) || 0,
        bank_account_name: bankName,
        payment_reference,
      });
    } catch (jErr) {
      console.warn("No se pudo registrar el asiento de cruce bancario:", jErr);
    }

    revalidatePath("/erp/gastos");
    revalidatePath(`/erp/gastos/${expense_id}`);

    return { success: true, url: `/erp/gastos/${expense_id}` };
  } catch (err: any) {
    console.error("Error en recordExpensePaymentAction:", err);
    return { success: false, error: err?.message || "Error al registrar el pago del gasto" };
  }
}
