import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { assertPermission, assertWritePermission } from "@/lib/auth-action";
import { assertMonthOpen, isMonthClosed } from "@/lib/accounting";
import NuevaCompraForm from "../../nuevo/NuevaCompraForm";
import { ExpenseItemRow, parseItemCategoryAndDesc } from "@/lib/expense-types";

export const dynamic = "force-dynamic";

async function updateExpense(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/gastos");
  const id = formData.get("id") as string;
  const new_expense_date = formData.get("expense_date") as string;

  const supabase = createAdminClient();
  const { data: originalExp } = await supabase.from("expenses").select("expense_date").eq("id", id).single();

  if (originalExp?.expense_date) {
    await assertMonthOpen(originalExp.expense_date);
  }
  await assertMonthOpen(new_expense_date);

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
  const authorization_number = (formData.get("authorization_number") as string)?.trim() || null;
  const factura_recibida_clave_acceso = (formData.get("factura_recibida_clave_acceso") as string)?.trim() || null;
  let description         = (formData.get("description") as string)?.trim() || null;
  let payment_reference   = (formData.get("payment_reference") as string)?.trim() || null;

  // Manejo de comprobante digital / archivo de respaldo
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

  if (payment_method === "tarjeta_credito") {
    const card_type = (formData.get("card_type") as string)?.trim() || "";
    const card_lote = (formData.get("card_lote") as string)?.trim() || "";
    const card_voucher = (formData.get("card_voucher") as string)?.trim() || "";
    payment_reference = `Tarj: ${card_type} | Lote: ${card_lote} | Voucher: ${card_voucher}`;
  }

  const { data: currentExp } = await supabase.from("expenses").select("notes").eq("id", id).maybeSingle();
  let cleanNotes = (currentExp?.notes || "")
    .replace(/\[AREA:[a-z]+\]/gi, "")
    .replace(/\[COMPROBANTE:[^\]]+\]/gi, "")
    .replace(/\[FACTURA_SRI:[^\]]+\]/gi, "")
    .trim();

  let updatedNotes = `[AREA:${area}]`;
  if (receiptUrl) {
    updatedNotes += ` [COMPROBANTE:${receiptUrl}]`;
  }
  if (factura_recibida_clave_acceso) {
    updatedNotes += ` [FACTURA_SRI:${factura_recibida_clave_acceso}]`;
  }
  if (cleanNotes) {
    updatedNotes += ` ${cleanNotes}`;
  }

  const updatePayload: Record<string, any> = {
    supplier_name,
    supplier_ruc:      (formData.get("supplier_ruc") as string)?.trim() || null,
    document_number:   (formData.get("document_number") as string)?.trim() || null,
    authorization_number,
    expense_date:      new_expense_date,
    category,
    area,
    description,
    notes:             updatedNotes,
    subtotal_0:        subtotal0,
    subtotal_15:       subtotal15,
    iva_amount:        ivaAmount,
    total,
    payment_method,
    bank_account_id:   bank_account_id || null,
    payment_reference: payment_reference || null,
    receipt_url:       receiptUrl || null,
    factura_recibida_clave_acceso: factura_recibida_clave_acceso || null,
  };

  let { error } = await supabase.from("expenses").update(updatePayload).eq("id", id);

  if (error && (error.message.includes("factura_recibida_clave_acceso") || error.code === "PGRST204" || error.code === "42703")) {
    delete updatePayload.factura_recibida_clave_acceso;
    const retry = await supabase.from("expenses").update(updatePayload).eq("id", id);
    error = retry.error;
  }

  if (error && (error.message.includes("receipt_url") || error.code === "PGRST204" || error.code === "42703")) {
    delete updatePayload.receipt_url;
    const retry = await supabase.from("expenses").update(updatePayload).eq("id", id);
    error = retry.error;
  }

  if (error && (error.message.includes("area") || error.code === "PGRST204" || error.code === "42703")) {
    delete updatePayload.area;
    const retry = await supabase.from("expenses").update(updatePayload).eq("id", id);
    error = retry.error;
  }

  if (error && (error.message.includes("authorization_number") || error.code === "PGRST204")) {
    delete updatePayload.authorization_number;
    if (authorization_number) {
      updatePayload.description = description ? `${description} | Aut: ${authorization_number}` : `Aut: ${authorization_number}`;
    }
    await supabase.from("expenses").update(updatePayload).eq("id", id);
  }

  // Actualizar líneas de detalle en expense_items
  const itemsJson = formData.get("items_json") as string | null;
  if (itemsJson) {
    try {
      const parsedItems = JSON.parse(itemsJson);
      if (Array.isArray(parsedItems)) {
        await supabase.from("expense_items").delete().eq("expense_id", id);
        if (parsedItems.length > 0) {
          const itemsToInsert = parsedItems.map((it: any) => ({
            expense_id: id,
            description: it.category ? `[${it.category}] ${it.description || "Item de gasto"}` : (it.description || "Item de gasto"),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            iva_rate: Number(it.iva_rate) || 0,
            subtotal: Number(it.subtotal) || 0,
            iva_amount: Number(it.iva_amount) || 0,
            total: Number(it.total) || 0,
          }));
          await supabase.from("expense_items").insert(itemsToInsert);
        }
      }
    } catch (err) {
      console.error("Error actualizando expense_items:", err);
    }
  }

  return { success: true, url: `/erp/gastos/${id}` };
}

export default async function EditarGastoPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPermission("/erp/gastos");
  await assertWritePermission("/erp/gastos");

  const { id } = await params;
  const supabase = createAdminClient();

  let rawItems: any[] = [];
  try {
    const { data: itData } = await supabase
      .from("expense_items")
      .select("*")
      .eq("expense_id", id)
      .order("created_at", { ascending: true });
    if (itData) rawItems = itData;
  } catch {
    // Si la tabla no está creada aún
  }

  const [
    { data: rawExpense },
    { data: allAccounts },
    { data: pastExpenses },
  ] = await Promise.all([
    supabase.from("expenses").select("*").eq("id", id).single(),
    supabase.from("bank_accounts").select("id, bank_name, account_number, account_type, notes").eq("is_active", true).order("bank_name"),
    supabase.from("expenses").select("supplier_ruc, supplier_name").not("supplier_ruc", "is", null).not("supplier_name", "is", null).order("created_at", { ascending: false }),
  ]);

  if (!rawExpense) notFound();
  const expense = rawExpense as any;

  const initialItems: ExpenseItemRow[] = rawItems.map((it: any) => {
    const parsed = parseItemCategoryAndDesc(it.description);
    return {
      id: it.id,
      description: parsed.description,
      category: it.category || parsed.category,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      iva_rate: (Number(it.iva_rate) === 15 ? 15 : 0) as 0 | 15,
    };
  });

  const isClosed = await isMonthClosed(expense.expense_date);

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
          href={`/erp/gastos/${id}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Editar Gasto / Compra</h1>
          <p className="text-xs text-ink-500 font-mono">ID: {id.slice(0, 8)} · Modificación de datos, detalle y respaldo</p>
        </div>
      </div>

      {isClosed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <h2 className="text-base font-bold text-amber-900">Período Contable Cerrado</h2>
          <p className="text-xs text-amber-800 leading-relaxed max-w-md mx-auto">
            Este gasto pertenece al período contable <strong className="font-mono">{expense.expense_date.slice(0, 7)}</strong>, el cual ya fue CERRADO. No es posible modificar datos de un mes cerrado.
          </p>
          <div className="pt-2">
            <Link
              href={`/erp/gastos/${id}`}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 rounded-xl font-semibold transition-colors"
            >
              Volver al Detalle del Gasto
            </Link>
          </div>
        </div>
      ) : (
        <NuevaCompraForm
          today={expense.expense_date}
          bankAccounts={bankAccounts}
          cajaAccounts={cajaAccounts}
          knownSuppliersList={knownSuppliersList}
          initialData={expense}
          initialItems={initialItems}
          saveExpense={updateExpense}
        />
      )}
    </div>
  );
}
