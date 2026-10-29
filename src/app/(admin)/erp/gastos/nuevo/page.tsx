import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createExpenseJournalEntry, assertMonthOpen } from "@/lib/accounting";
import NuevaCompraForm from "./NuevaCompraForm";
import { assertWritePermission } from "@/lib/auth-action";
import { FacturaRecibida } from "@/lib/expense-types";

export const dynamic = "force-dynamic";

async function saveExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const expense_date = formData.get("expense_date") as string;
  await assertMonthOpen(expense_date);

  const supabase   = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const rawSubtotal0  = Number(formData.get("subtotal_0") || 0);
  const rawSubtotal15 = Number(formData.get("subtotal_15") || 0);
  const rawIva        = Number(formData.get("iva_amount") || 0);
  const rawTotal      = Number(formData.get("total") || 0);

  let subtotal0  = Math.round(rawSubtotal0 * 100) / 100;
  let subtotal15 = Math.round(rawSubtotal15 * 100) / 100;
  let ivaAmount  = Math.round(rawIva * 100) / 100;
  let total      = rawTotal > 0 ? Math.round(rawTotal * 100) / 100 : Math.round((subtotal0 + subtotal15 + ivaAmount) * 100) / 100;

  const category          = formData.get("category") as string;
  const area              = ((formData.get("area") as string) || "clinica").toLowerCase();
  const payment_method    = formData.get("payment_method") as string;
  const supplier_name     = (formData.get("supplier_name") as string).trim();
  const bank_account_id   = (formData.get("bank_account_id") as string) || null;
  let payment_reference = (formData.get("payment_reference") as string)?.trim() || null;

  if (payment_method === "tarjeta_credito") {
    const card_type = (formData.get("card_type") as string)?.trim() || "";
    const card_lote = (formData.get("card_lote") as string)?.trim() || "";
    const card_voucher = (formData.get("card_voucher") as string)?.trim() || "";
    payment_reference = `Tarj: ${card_type} | Lote: ${card_lote} | Voucher: ${card_voucher}`;
  }

  const authorization_number = (formData.get("authorization_number") as string)?.trim() || null;
  const factura_recibida_clave_acceso = (formData.get("factura_recibida_clave_acceso") as string)?.trim() || null;
  let description = (formData.get("description") as string)?.trim() || null;

  // Manejo de archivo de respaldo / comprobante digital
  const receiptFile = formData.get("receipt_file") as File | null;
  let receiptUrl: string | null = (formData.get("existing_receipt_url") as string)?.trim() || null;

  if (receiptFile && receiptFile.size > 0) {
    try {
      const rawBytes = Buffer.from(await receiptFile.arrayBuffer());
      let uploadBuffer: Buffer = rawBytes;
      let contentType = receiptFile.type || "application/octet-stream";
      let fileExt = receiptFile.name.split(".").pop()?.toLowerCase() || "pdf";

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
          console.warn("No se pudo optimizar imagen de respaldo:", optErr);
        }
      }

      const timestamp = Date.now();
      const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 30);
      const fileName = `gastos/${timestamp}_${safeName}.${fileExt}`;

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
        receiptUrl = urlData?.publicUrl || null;
      } else {
        console.error("Error al subir archivo de respaldo:", uploadError);
      }
    } catch (err) {
      console.error("Error procesando comprobante adjunto:", err);
    }
  }

  const document_type = (formData.get("document_type") as string) || "factura";
  let notes = `[AREA:${area}] [TIPO:${document_type}]`;
  if (receiptUrl) {
    notes += ` [COMPROBANTE:${receiptUrl}]`;
  }
  if (factura_recibida_clave_acceso) {
    notes += ` [FACTURA_SRI:${factura_recibida_clave_acceso}]`;
  }

  const insertPayload: Record<string, any> = {
    supplier_name,
    supplier_ruc:      (formData.get("supplier_ruc") as string)?.trim() || null,
    document_number:   (formData.get("document_number") as string)?.trim() || null,
    authorization_number,
    expense_date,
    category,
    area,
    description,
    notes,
    subtotal_0:        subtotal0,
    subtotal_15:       subtotal15,
    iva_amount:        ivaAmount,
    total,
    payment_method,
    bank_account_id:   bank_account_id || null,
    payment_reference: payment_reference || null,
    created_by_id:     user?.id ?? null,
    created_by_email:  user?.email ?? null,
    receipt_url:       receiptUrl || null,
    factura_recibida_clave_acceso: factura_recibida_clave_acceso || null,
  };

  let { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert(insertPayload)
    .select()
    .single();

  if (expenseError && (expenseError.message.includes("factura_recibida_clave_acceso") || expenseError.code === "PGRST204" || expenseError.code === "42703")) {
    delete insertPayload.factura_recibida_clave_acceso;
    const retry = await supabase.from("expenses").insert(insertPayload).select().single();
    expense = retry.data;
    expenseError = retry.error;
  }

  if (expenseError && (expenseError.message.includes("receipt_url") || expenseError.code === "PGRST204" || expenseError.code === "42703")) {
    delete insertPayload.receipt_url;
    const retry = await supabase.from("expenses").insert(insertPayload).select().single();
    expense = retry.data;
    expenseError = retry.error;
  }

  if (expenseError && (expenseError.message.includes("area") || expenseError.code === "PGRST204" || expenseError.code === "42703")) {
    delete insertPayload.area;
    const retry = await supabase.from("expenses").insert(insertPayload).select().single();
    expense = retry.data;
    expenseError = retry.error;
  }

  if (expenseError && (expenseError.message.includes("authorization_number") || expenseError.code === "PGRST204")) {
    delete insertPayload.authorization_number;
    if (authorization_number) {
      insertPayload.description = description ? `${description} | Aut: ${authorization_number}` : `Aut: ${authorization_number}`;
    }
    const fallback = await supabase.from("expenses").insert(insertPayload).select().single();
    expense = fallback.data;
    expenseError = fallback.error;
  }

  if (expenseError || !expense) throw new Error(expenseError?.message ?? "Error al guardar la compra");

  // Guardar detalle de ítems (expense_items)
  const itemsJson = formData.get("items_json") as string | null;
  let parsedItemsList: any[] = [];
  if (itemsJson) {
    try {
      const parsedItems = JSON.parse(itemsJson);
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        parsedItemsList = parsedItems;
        const itemsToInsert = parsedItems.map((it: any) => ({
          expense_id: expense.id,
          description: it.category ? `[${it.category}] ${it.description || "Item de gasto"}` : (it.description || "Item de gasto"),
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          iva_rate: Number(it.iva_rate) || 0,
          subtotal: Number(it.subtotal) || 0,
          iva_amount: Number(it.iva_amount) || 0,
          total: Number(it.total) || 0,
        }));
        const { error: itemsErr } = await supabase.from("expense_items").insert(itemsToInsert);
        if (itemsErr) {
          console.warn("No se pudieron registrar las líneas en expense_items:", itemsErr.message);
        }
      }
    } catch (itParseErr) {
      console.error("Error al procesar líneas de detalle de gasto:", itParseErr);
    }
  }

  // Si viene vinculada una factura recibida del SRI, marcarla como registrada
  const effectiveSriClave = factura_recibida_clave_acceso || (authorization_number && authorization_number.length === 49 ? authorization_number : null);
  if (effectiveSriClave) {
    try {
      const updateData: Record<string, any> = {
        estado_facop: "registrado",
        expense_id: expense.id,
      };
      const { error: facUpdateErr } = await supabase
        .from("facturas_recibidas")
        .update(updateData)
        .eq("clave_acceso", effectiveSriClave);

      if (facUpdateErr && (facUpdateErr.message.includes("expense_id") || facUpdateErr.code === "42703")) {
        delete updateData.expense_id;
        await supabase
          .from("facturas_recibidas")
          .update(updateData)
          .eq("clave_acceso", effectiveSriClave);
      }
    } catch (facErr) {
      console.warn("No se pudo actualizar estado_facop en facturas_recibidas:", facErr);
    }
  }

  // Transacción bancaria automática (egreso) — no aplica a crédito
  if (bank_account_id && payment_method !== "credito") {
    try {
      const pmMap: Record<string, string> = {
        efectivo:      "efectivo",
        transferencia: "transferencia",
        tarjeta_credito: "tarjeta_credito",
      };
      await supabase.from("bank_transactions").insert({
        account_id:     bank_account_id,
        type:           "egreso",
        amount:         total,
        date:           expense_date,
        description:    `Compra: ${supplier_name}${category ? ` (${category})` : ""}`,
        reference:      payment_reference,
        payment_method: pmMap[payment_method] ?? "transferencia",
        expense_id:     expense.id,
        status:         "confirmado",
        origin:         "automatico",
      });
    } catch (err) {
      console.error("Transacción bancaria no registrada:", err);
    }
  }

  // Asiento contable automático direccionando según categorías de ítems
  try {
    await createExpenseJournalEntry({
      expense_id: expense.id,
      expense_date,
      supplier_name,
      category,
      payment_method,
      subtotal_0: subtotal0,
      subtotal_15: subtotal15,
      iva_amount: ivaAmount,
      total,
      user_id: user?.id,
      user_email: user?.email,
      items: parsedItemsList.map((it: any) => ({
        description: it.description || "",
        category: it.category || category,
        subtotal: Number(it.subtotal) || 0,
      })),
    });
  } catch (err) {
    console.error("Asiento contable no generado:", err);
  }

  return { success: true };
}

export default async function NuevoGastoPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ factura?: string }>;
}) {
  await assertWritePermission("/erp/gastos");
  const searchParams = searchParamsPromise ? await searchParamsPromise : {};
  const today    = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();

  let pendingFacturas: FacturaRecibida[] = [];
  try {
    const { data: recData } = await supabase
      .from("facturas_recibidas")
      .select("*")
      .or("estado_facop.eq.pendiente,estado_facop.is.null")
      .order("fecha_emision", { ascending: false })
      .limit(60);
    if (recData) pendingFacturas = recData as FacturaRecibida[];
  } catch {
    // Si la tabla no está creada aún
  }

  const [
    { data: allAccounts },
    { data: pastExpenses },
  ] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("id, bank_name, account_number, account_type, notes")
      .eq("is_active", true)
      .order("bank_name"),
    supabase
      .from("expenses")
      .select("supplier_ruc, supplier_name")
      .not("supplier_ruc", "is", null)
      .not("supplier_name", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  // Si se solicitó una factura específica por URL y no está en la lista de pendientes
  if (searchParams.factura && !pendingFacturas.some((f) => f.clave_acceso === searchParams.factura)) {
    try {
      const { data: specificFac } = await supabase
        .from("facturas_recibidas")
        .select("*")
        .eq("clave_acceso", searchParams.factura)
        .maybeSingle();
      if (specificFac) {
        pendingFacturas = [specificFac as FacturaRecibida, ...pendingFacturas];
      }
    } catch {
      // Ignorar si la tabla no existe aún
    }
  }

  const bankAccounts = (allAccounts || []).filter((a: any) => a.account_type !== "caja");
  const cajaAccounts = (allAccounts || []).filter((a: any) => a.account_type === "caja");

  const knownSuppliersMap: Record<string, string> = {};
  const knownSuppliersList: { ruc: string; name: string }[] = [];

  (pastExpenses || []).forEach((exp: any) => {
    const ruc = exp.supplier_ruc?.trim();
    const name = exp.supplier_name?.trim();
    if (ruc && name && !knownSuppliersMap[ruc]) {
      knownSuppliersMap[ruc] = name;
      knownSuppliersList.push({ ruc, name });
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-3.5">
      <div className="flex items-center gap-3">
        <Link
          href="/erp/gastos"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Registrar Gasto / Compra</h1>
          <p className="text-xs text-ink-500">Cabecera, detalle de ítems, vinculación con facturas recibidas del SRI y respaldo digital</p>
        </div>
      </div>

      <NuevaCompraForm
        today={today}
        bankAccounts={bankAccounts}
        cajaAccounts={cajaAccounts}
        knownSuppliersList={knownSuppliersList}
        pendingFacturas={pendingFacturas}
        initialFacturaClave={searchParams.factura || null}
        saveExpense={saveExpense}
      />
    </div>
  );
}
