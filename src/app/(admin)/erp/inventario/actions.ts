"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { hasPermission, type UserRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";

async function getNextSku(
  supabase: ReturnType<typeof createAdminClient>,
  category: string,
  prefix: string
): Promise<string> {
  const { data } = await supabase
    .from("inventory_products")
    .select("sku")
    .like("sku", `${prefix}-%`);

  let maxNum = 0;
  (data || []).forEach((row) => {
    const parts = row.sku?.split("-");
    if (parts && parts.length === 2) {
      const num = parseInt(parts[1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

export async function createInventoryProductAction(formData: FormData) {
  const supabase = createAdminClient();
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();

  if (!user) {
    throw new Error("Sin sesión activa");
  }

  const role = (user.app_metadata?.role as string) ?? "recepcionista";
  let allowedPaths: string[] | null = null;
  if (role !== "admin") {
    const { data } = await supabase
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);
    allowedPaths = (data || []).map((p: any) => p.path);
  }

  if (!hasPermission(role, "/erp/inventario/modificar", allowedPaths)) {
    throw new Error("Sin permisos para crear productos en inventario");
  }

  const name = (formData.get("name") as string || "").trim();
  const category = (formData.get("category") as string || "").trim();
  const prefix = (formData.get("category_prefix") as string || "OTR").trim();
  const unit_of_measure = (formData.get("unit_of_measure") as string || "Unidad").trim();
  const initial_stock = Number(formData.get("initial_stock") || 0);
  const minimum_stock = Number(formData.get("minimum_stock") || 5);

  if (!name || !category) {
    throw new Error("Por favor completa el nombre y la categoría del insumo.");
  }

  const sku = await getNextSku(supabase, category, prefix || "OTR");

  const { data: product, error: productError } = await supabase
    .from("inventory_products")
    .insert({
      name,
      sku,
      category,
      unit_of_measure,
      minimum_stock,
      current_stock: 0,
    })
    .select()
    .single();

  if (productError || !product) {
    console.error(productError);
    throw new Error("Error creando el insumo en la base de datos.");
  }

  if (initial_stock > 0) {
    await supabase.from("inventory_transactions").insert({
      product_id: product.id,
      type: "entrada",
      quantity: initial_stock,
      reason: "Inventario Inicial",
      created_by_id: user?.id ?? null,
      created_by_email: user?.email ?? null,
    });
  }

  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: (user?.app_metadata?.role as UserRole) ?? null,
    action: "create",
    resource: "inventory_product",
    resource_id: product?.id,
    description: `Producto creado: ${name} (${sku}) - Categoría: ${category}`,
    metadata: { name, sku, category, unit_of_measure, minimum_stock, initial_stock },
  });

  revalidatePath("/erp/inventario");
  return { success: true };
}

export async function saveInventoryTransactionAction(formData: FormData) {
  const supabaseAction = createAdminClient();
  const sessionClient = createClient();
  const { data: { user: userAction } } = await sessionClient.auth.getUser();

  if (!userAction) {
    throw new Error("Sin sesión activa");
  }

  const roleAction = (userAction.app_metadata?.role as string) ?? "recepcionista";
  let allowedPathsAction: string[] | null = null;
  if (roleAction !== "admin") {
    const { data } = await supabaseAction
      .from("role_permissions")
      .select("path")
      .eq("role_name", roleAction);
    allowedPathsAction = (data || []).map((p: any) => p.path);
  }

  if (!hasPermission(roleAction, "/erp/inventario/transacciones/crear", allowedPathsAction)) {
    throw new Error("Sin permisos para registrar transacciones de inventario");
  }

  const product_id = formData.get("product_id") as string;
  const type = formData.get("type") as "entrada" | "salida";
  const quantity = Number(formData.get("quantity"));
  const reason = (formData.get("reason") as string || "").trim();

  if (!product_id || !quantity || quantity <= 0) {
    throw new Error("Por favor ingresa una cantidad válida mayor a 0.");
  }

  const { data: prod } = await supabaseAction
    .from("inventory_products")
    .select("name, sku, current_stock")
    .eq("id", product_id)
    .single();

  if (type === "salida" && prod && prod.current_stock < quantity) {
    throw new Error(`Stock insuficiente. Stock actual: ${prod.current_stock}`);
  }

  const { data: tx, error } = await supabaseAction
    .from("inventory_transactions")
    .insert({
      product_id,
      type,
      quantity,
      reason,
      created_by_id: userAction?.id ?? null,
      created_by_email: userAction?.email ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("Error al guardar la transacción de inventario.");
  }

  await logAudit({
    user_id: userAction?.id,
    user_email: userAction?.email,
    user_role: (userAction?.app_metadata?.role as UserRole) ?? null,
    action: "create",
    resource: "inventory_transaction",
    resource_id: tx?.id,
    description: `${type === "entrada" ? "Entrada" : "Salida"} de ${quantity} unidades de ${prod?.name || product_id}. Motivo: ${reason}`,
    metadata: { type, quantity, reason, product_name: prod?.name, sku: prod?.sku },
  });

  revalidatePath("/erp/inventario");
  revalidatePath("/erp/inventario/transacciones");
  return { success: true };
}
