"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { createAssetPurchaseJournalEntry } from "@/lib/accounting";
import { ASSET_TYPES } from "@/lib/fixed-assets-utils";
import { getNextAssetCode } from "@/lib/fixed-assets-server";

export async function createAssetAction(data: {
  name: string;
  asset_type?: string;
  category?: string;
  description?: string | null;
  purchase_date: string;
  purchase_value: number;
  salvage_value?: number;
  useful_life_years?: number;
  supplier_name?: string | null;
  supplier_ruc?: string | null;
  invoice_number?: string | null;
  bank_account_id?: string | null;
  payment_reference?: string | null;
  register_in_expenses?: boolean;
}) {
  await assertWritePermission("/erp/activos");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const name = data.name?.trim();
  const purchase_value = Number(data.purchase_value);
  const purchase_date = data.purchase_date;

  if (!name || purchase_value <= 0 || !purchase_date) {
    throw new Error("Por favor completa los campos obligatorios (*).");
  }

  // 1. Resolver tipo oficial, prefijo, cuenta contable y vida útil
  const typeKey = data.asset_type || "equipos_medicos";
  const typeDef = ASSET_TYPES[typeKey] || ASSET_TYPES.equipos_medicos;

  // 2. Generar código secuencial según tipo (ej. EQM-0001, MUE-0001, COM-0001)
  const nextCode = await getNextAssetCode(typeDef.prefix);

  const usefulLife = Number(data.useful_life_years || typeDef.years);
  const cleanCategory = typeDef.category;

  const descNotes = `[CODIGO:${nextCode}] [CUENTA:${typeDef.accountCode}] ${data.description?.trim() || ""}`.trim();

  // 3. Insertar activo en fixed_assets
  const assetPayload: Record<string, any> = {
    name,
    category: cleanCategory,
    description: descNotes,
    purchase_date,
    purchase_value,
    salvage_value: Number(data.salvage_value || 0),
    useful_life_years: usefulLife,
    supplier_name: data.supplier_name?.trim() || null,
    supplier_ruc: data.supplier_ruc?.trim() || null,
    invoice_number: data.invoice_number?.trim() || null,
    bank_account_id: data.bank_account_id || null,
    payment_reference: data.payment_reference?.trim() || null,
    created_by_id: user?.id ?? null,
    code: nextCode,
    account_code: typeDef.accountCode,
  };

  let { data: asset, error } = await supabase
    .from("fixed_assets")
    .insert(assetPayload)
    .select()
    .single();

  // Fallback si la columna code o account_code no existen en la base aún
  if (error && (error.code === "42703" || error.message.includes("column") || error.message.includes("does not exist"))) {
    delete assetPayload.code;
    delete assetPayload.account_code;
    const retry = await supabase.from("fixed_assets").insert(assetPayload).select().single();
    asset = retry.data;
    error = retry.error;
  }

  if (error || !asset) {
    throw new Error(error?.message || "Error al registrar el activo fijo.");
  }

  // 4. (Opcional) Registrar también como compra en el módulo de Gastos
  if (data.register_in_expenses) {
    try {
      const expInsert: Record<string, any> = {
        supplier_name: data.supplier_name?.trim() || "Proveedor de Activo Fijo",
        supplier_ruc: data.supplier_ruc?.trim() || null,
        document_number: data.invoice_number?.trim() || null,
        expense_date: purchase_date,
        category: typeDef.accountName,
        account_code: typeDef.accountCode,
        account_name: typeDef.accountName,
        group_code: "1.2.01",
        group_name: "Propiedad, Planta y Equipo",
        area: "clinica",
        description: `Compra Activo Fijo [${nextCode}] - ${name}`,
        notes: `[TIPO:factura] [ACTIVO_ID:${asset.id}]`,
        subtotal_0: purchase_value,
        subtotal_15: 0,
        iva_amount: 0,
        total: purchase_value,
        payment_method: data.bank_account_id ? "transferencia" : "credito",
        bank_account_id: data.bank_account_id || null,
        payment_reference: data.payment_reference?.trim() || null,
        created_by_id: user?.id ?? null,
      };

      const { data: exp } = await supabase.from("expenses").insert(expInsert).select().single();
      if (exp) {
        await supabase.from("expense_items").insert({
          expense_id: exp.id,
          description: `[${nextCode}] ${name}`,
          category: typeDef.accountName,
          account_code: typeDef.accountCode,
          account_name: typeDef.accountName,
          group_code: "1.2.01",
          group_name: "Propiedad, Planta y Equipo",
          quantity: 1,
          unit_price: purchase_value,
          iva_rate: 0,
          subtotal: purchase_value,
          iva_amount: 0,
          total: purchase_value,
        });

        // Vincular el ID del gasto en fixed_assets si existe la columna
        try {
          await supabase.from("fixed_assets").update({ expense_id: exp.id }).eq("id", asset.id);
        } catch {
          // opcional
        }
      }
    } catch (expErr) {
      console.warn("No se pudo crear compra complementaria en expenses:", expErr);
    }
  }

  // 5. Egreso bancario automático si se pagó con banco y no se delegó al gasto
  if (asset && data.bank_account_id && !data.register_in_expenses) {
    try {
      await supabase.from("bank_transactions").insert({
        account_id: data.bank_account_id,
        type: "egreso",
        amount: purchase_value,
        date: purchase_date,
        description: `Compra activo fijo [${nextCode}]: ${name}`,
        reference: data.payment_reference?.trim() || null,
        payment_method: "transferencia",
        status: "confirmado",
      });
    } catch (e) {
      console.error("Transacción bancaria no creada:", e);
    }
  }

  // 6. Asiento contable de compra (si no se delegó a gastos)
  if (asset && !data.register_in_expenses) {
    try {
      await createAssetPurchaseJournalEntry({
        asset_id: asset.id,
        purchase_date,
        asset_name: `[${nextCode}] ${name}`,
        category: cleanCategory,
        purchase_value,
        on_credit: !data.bank_account_id,
        user_id: user?.id,
        user_email: user?.email,
      });
    } catch (e) {
      console.error("Asiento de activo no generado:", e);
    }
  }

  revalidatePath("/erp/activos");
  revalidatePath("/erp/gastos");
  revalidatePath("/erp/bancos");
  return { success: true, assetId: asset.id, code: nextCode };
}
