"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { createAssetPurchaseJournalEntry } from "@/lib/accounting";

export async function createAssetAction(data: {
  name: string;
  category: string;
  description?: string | null;
  purchase_date: string;
  purchase_value: number;
  salvage_value?: number;
  useful_life_years: number;
  supplier_name?: string | null;
  supplier_ruc?: string | null;
  invoice_number?: string | null;
  bank_account_id?: string | null;
  payment_reference?: string | null;
}) {
  await assertWritePermission("/erp/activos");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const name = data.name?.trim();
  const category = data.category;
  const purchase_value = Number(data.purchase_value);
  const purchase_date = data.purchase_date;

  if (!name || !category || purchase_value <= 0 || !purchase_date) {
    throw new Error("Por favor completa los campos obligatorios.");
  }

  const { data: asset, error } = await supabase.from("fixed_assets").insert({
    name,
    category,
    description: data.description?.trim() || null,
    purchase_date,
    purchase_value,
    salvage_value: Number(data.salvage_value || 0),
    useful_life_years: Number(data.useful_life_years || 10),
    supplier_name: data.supplier_name?.trim() || null,
    supplier_ruc: data.supplier_ruc?.trim() || null,
    invoice_number: data.invoice_number?.trim() || null,
    bank_account_id: data.bank_account_id || null,
    payment_reference: data.payment_reference?.trim() || null,
    created_by_id: user?.id ?? null,
  }).select().single();

  if (error) throw new Error(error.message || "Error al crear el activo fijo.");

  // Egreso bancario automático
  if (asset && data.bank_account_id) {
    try {
      await supabase.from("bank_transactions").insert({
        account_id: data.bank_account_id,
        type: "egreso",
        amount: purchase_value,
        date: purchase_date,
        description: `Compra activo fijo: ${name}`,
        reference: data.payment_reference?.trim() || null,
        payment_method: "transferencia",
        status: "confirmado",
      });
    } catch (e) {
      console.error("Transacción bancaria no creada:", e);
    }
  }

  // Asiento contable de compra
  if (asset) {
    try {
      await createAssetPurchaseJournalEntry({
        asset_id: asset.id,
        purchase_date,
        asset_name: name,
        category,
        purchase_value,
        on_credit: !data.bank_account_id,
        user_id: user?.id,
        user_email: user?.email,
      });
    } catch (e) {
      console.error("Asiento no generado:", e);
    }
  }

  revalidatePath("/erp/activos");
  revalidatePath("/erp/bancos");
  return { success: true, assetId: asset.id };
}
