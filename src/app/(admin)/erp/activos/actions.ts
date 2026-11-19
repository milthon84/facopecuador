"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { createAssetPurchaseJournalEntry, createDepreciationJournalEntry } from "@/lib/accounting";
import { ASSET_TYPES, extractAssetCode } from "@/lib/fixed-assets-utils";
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
  create_journal_entry?: boolean;
  expense_id?: string | null;
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

  // 6. Asiento contable de compra (solo si se solicita y no se delegó a gastos)
  const shouldCreateJournal = data.create_journal_entry !== false && !data.register_in_expenses;

  if (asset && shouldCreateJournal) {
    try {
      await createAssetPurchaseJournalEntry({
        asset_id: asset.id,
        purchase_date,
        asset_name: `[${nextCode}] ${name}`,
        category: cleanCategory,
        account_code: typeDef.accountCode,
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

const r2 = (n: number) => Math.round(n * 100) / 100;

export async function processBatchDepreciationAction(data: { period: string }) {
  await assertWritePermission("/erp/activos");

  const period = data.period?.trim();
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("El período debe tener el formato YYYY-MM (ej. 2026-11).");
  }

  const [targetYear, targetMonth] = period.split("-").map(Number);

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // 1. Obtener activos fijos activos
  const { data: assets, error: assetsErr } = await supabase
    .from("fixed_assets")
    .select("id, name, code, category, account_code, description, purchase_date, purchase_value, salvage_value, useful_life_years, status")
    .eq("status", "active")
    .order("purchase_date", { ascending: true });

  if (assetsErr || !assets) {
    throw new Error("No se pudieron cargar los activos fijos: " + (assetsErr?.message || ""));
  }

  // 2. Obtener depreciaciones ya registradas en este período
  const { data: existingDeps } = await supabase
    .from("asset_depreciations")
    .select("asset_id, period")
    .eq("period", period);

  const registeredSet = new Set((existingDeps || []).map((d) => d.asset_id));

  let processedCount = 0;
  let totalAmount = 0;
  let alreadyRegisteredCount = 0;
  let futureCount = 0;
  let finishedCount = 0;

  for (const asset of assets) {
    // Si ya está registrado en este período, omitir
    if (registeredSet.has(asset.id)) {
      alreadyRegisteredCount++;
      continue;
    }

    const start = new Date(asset.purchase_date + "T12:00:00");
    const startYear = start.getFullYear();
    const startMonth = start.getMonth() + 1; // 1..12

    // Meses transcurridos desde adquisición
    const monthsElapsed = (targetYear - startYear) * 12 + (targetMonth - startMonth);

    // Si aún no se había adquirido en este período
    if (monthsElapsed < 0) {
      futureCount++;
      continue;
    }

    const usefulLife = Number(asset.useful_life_years || 10);
    const totalMonths = usefulLife * 12;

    // Si ya completó su vida útil antes de este mes
    if (monthsElapsed >= totalMonths) {
      finishedCount++;
      continue;
    }

    const purchaseVal = Number(asset.purchase_value || 0);
    const salvageVal = Number(asset.salvage_value || 0);
    const depreciable = purchaseVal - salvageVal;
    if (depreciable <= 0) continue;

    const monthly = r2(depreciable / totalMonths);
    const accumulated = r2(monthly * (monthsElapsed + 1));
    const bookValue = r2(Math.max(purchaseVal - accumulated, salvageVal));

    const assetCode = extractAssetCode(asset);
    const fullName = assetCode ? `[${assetCode}] ${asset.name}` : asset.name;

    // 3. Crear Asiento Contable
    let journal_entry_id: string | null = null;
    try {
      journal_entry_id = await createDepreciationJournalEntry({
        asset_id: asset.id,
        asset_name: fullName,
        category: asset.category,
        account_code: asset.account_code || undefined,
        period,
        monthly_amount: monthly,
        user_id: user?.id,
        user_email: user?.email,
      });
    } catch (e) {
      console.error(`Error generando asiento de depreciación para ${fullName}:`, e);
    }

    // 4. Guardar en asset_depreciations
    await supabase.from("asset_depreciations").upsert({
      asset_id: asset.id,
      period,
      monthly_amount: monthly,
      accumulated,
      book_value: bookValue,
      journal_entry_id,
    }, { onConflict: "asset_id,period" });

    processedCount++;
    totalAmount = r2(totalAmount + monthly);
  }

  revalidatePath("/erp/activos");
  revalidatePath("/erp/contabilidad/diario");
  revalidatePath("/erp/contabilidad/mayor");
  revalidatePath("/erp/contabilidad/balance");
  revalidatePath("/erp/contabilidad/cierre");

  return {
    success: true,
    period,
    processedCount,
    totalAmount,
    alreadyRegisteredCount,
    futureCount,
    finishedCount,
  };
}

export async function registerSingleDepreciationAction(data: {
  asset_id: string;
  period: string;
  monthly_amount: number;
  accumulated: number;
  book_value: number;
}) {
  await assertWritePermission("/erp/activos");

  const supabase = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const { asset_id, period, monthly_amount, accumulated, book_value } = data;

  const { data: asset } = await supabase
    .from("fixed_assets")
    .select("id, name, category, code, account_code, description")
    .eq("id", asset_id)
    .single();

  if (!asset) throw new Error("Activo no encontrado");

  const assetCode = extractAssetCode(asset);
  const fullName = assetCode ? `[${assetCode}] ${asset.name}` : asset.name;

  let journal_entry_id: string | null = null;
  try {
    journal_entry_id = await createDepreciationJournalEntry({
      asset_id,
      asset_name: fullName,
      category: asset.category,
      account_code: asset.account_code || undefined,
      period,
      monthly_amount,
      user_id: user?.id,
      user_email: user?.email,
    });
  } catch (e) {
    console.error("Asiento no generado:", e);
  }

  await supabase.from("asset_depreciations").upsert({
    asset_id,
    period,
    monthly_amount,
    accumulated,
    book_value,
    journal_entry_id,
  }, { onConflict: "asset_id,period" });

  revalidatePath(`/erp/activos/${asset_id}`);
  revalidatePath("/erp/activos");
  revalidatePath("/erp/contabilidad/diario");
  revalidatePath("/erp/contabilidad/mayor");
  revalidatePath("/erp/contabilidad/balance");

  return { success: true, journal_entry_id };
}
