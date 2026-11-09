import { createAdminClient } from "@/lib/supabase/admin";
import {
  ExpenseGroup,
  ExpenseMovementAccount,
  ExpenseAccountsCatalog,
  FALLBACK_EXPENSE_GROUPS,
  FALLBACK_EXPENSE_MOVEMENTS,
} from "./expense-accounts";

/**
 * Obtiene el catálogo dinámico de cuentas de gasto y activos desde la BD Supabase,
 * organizado por grupos y cuentas de movimiento.
 */
export async function getExpenseAccountsCatalog(): Promise<ExpenseAccountsCatalog> {
  const supabase = createAdminClient();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("code, name, type, subtype, is_movement, active")
    .or("type.eq.GASTO,code.like.1.2.01%")
    .eq("active", true)
    .order("code", { ascending: true });

  if (error || !accounts || accounts.length === 0) {
    const accountsByGroup: Record<string, ExpenseMovementAccount[]> = {};
    for (const mov of FALLBACK_EXPENSE_MOVEMENTS) {
      if (!accountsByGroup[mov.group_code]) accountsByGroup[mov.group_code] = [];
      accountsByGroup[mov.group_code].push(mov);
    }
    return {
      groups: FALLBACK_EXPENSE_GROUPS,
      accountsByGroup,
      allMovements: FALLBACK_EXPENSE_MOVEMENTS,
    };
  }

  // Filtrar grupos (cuentas que NO son de movimiento y tienen nivel de subgrupo ej. 5.1.01, 5.2.03, etc.)
  const rawGroups = accounts.filter((a) => {
    const segments = a.code.split(".");
    return !a.is_movement && segments.length === 3;
  });

  const groupsMap = new Map<string, ExpenseGroup>();
  for (const g of rawGroups) {
    groupsMap.set(g.code, { code: g.code, name: g.name, type: g.type });
  }
  for (const fg of FALLBACK_EXPENSE_GROUPS) {
    if (!groupsMap.has(fg.code)) {
      groupsMap.set(fg.code, fg);
    }
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  // Filtrar cuentas de movimiento (cuentas con is_movement = true)
  const rawMovements = accounts.filter((a) => a.is_movement);
  const movementsMap = new Map<string, ExpenseMovementAccount>();

  for (const m of rawMovements) {
    const segments = m.code.split(".");
    const groupCode = segments.slice(0, 3).join(".");
    movementsMap.set(m.code, {
      code: m.code,
      name: m.name,
      group_code: groupCode,
      type: m.type,
    });
  }

  for (const fm of FALLBACK_EXPENSE_MOVEMENTS) {
    if (!movementsMap.has(fm.code)) {
      movementsMap.set(fm.code, fm);
    }
  }

  const allMovements = Array.from(movementsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  const accountsByGroup: Record<string, ExpenseMovementAccount[]> = {};
  for (const mov of allMovements) {
    if (!accountsByGroup[mov.group_code]) {
      accountsByGroup[mov.group_code] = [];
    }
    accountsByGroup[mov.group_code].push(mov);
  }

  // Solo incluir grupos que tengan al menos una cuenta de movimiento
  const groupsWithMovements = groups.filter(
    (g) => accountsByGroup[g.code] && accountsByGroup[g.code].length > 0
  );

  return {
    groups: groupsWithMovements,
    accountsByGroup,
    allMovements,
  };
}

/**
 * Obtiene la cuenta habitual guardada de un proveedor por RUC.
 */
export async function getSupplierDefaultAccount(ruc: string | null | undefined): Promise<{
  ruc: string;
  razon_social?: string;
  default_group_code?: string;
  default_group_name?: string;
  default_account_code?: string;
  default_account_name?: string;
} | null> {
  if (!ruc) return null;
  const cleanRuc = ruc.trim();
  if (!cleanRuc) return null;

  const supabase = createAdminClient();

  // 1. Buscar en la tabla suppliers
  try {
    const { data: supplier, error } = await supabase
      .from("suppliers")
      .select("ruc, razon_social, default_group_code, default_group_name, default_account_code, default_account_name")
      .eq("ruc", cleanRuc)
      .maybeSingle();

    if (!error && supplier && supplier.default_account_code) {
      return supplier;
    }
  } catch {
    // Tabla suppliers aún no creada o en proceso de migración
  }

  // 2. Fallback: buscar en compras anteriores (expenses) de este RUC
  try {
    const { data: lastExp } = await supabase
      .from("expenses")
      .select("supplier_ruc, supplier_name, category")
      .eq("supplier_ruc", cleanRuc)
      .order("expense_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastExp) {
      const cat = (lastExp.category || "").toLowerCase();
      let suggestedAccountCode = "5.1.01.01";
      let suggestedGroupCode = "5.1.01";

      if (cat.includes("servicio") || cat.includes("luz") || cat.includes("agua") || cat.includes("internet")) {
        suggestedGroupCode = "5.2.03";
        suggestedAccountCode = "5.2.03.01";
      } else if (cat.includes("suministro") || cat.includes("oficina") || cat.includes("papel")) {
        suggestedGroupCode = "5.2.05";
        suggestedAccountCode = "5.2.05.01";
      } else if (cat.includes("arriendo")) {
        suggestedGroupCode = "5.2.02";
        suggestedAccountCode = "5.2.02.01";
      } else if (cat.includes("mantenimiento")) {
        suggestedGroupCode = "5.2.04";
        suggestedAccountCode = "5.2.04.01";
      } else if (cat.includes("activo") || cat.includes("equipo")) {
        suggestedGroupCode = "1.2.01";
        suggestedAccountCode = "1.2.01.01";
      }

      return {
        ruc: cleanRuc,
        razon_social: lastExp.supplier_name,
        default_group_code: suggestedGroupCode,
        default_account_code: suggestedAccountCode,
      };
    }
  } catch {
    // Ignore fallback errors
  }

  return null;
}

/**
 * Guarda o actualiza la cuenta habitual del proveedor para la próxima compra.
 */
export async function saveSupplierAccountMemory(params: {
  ruc: string;
  razon_social: string;
  group_code?: string | null;
  group_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
}): Promise<void> {
  if (!params.ruc || !params.account_code) return;
  const cleanRuc = params.ruc.trim();
  if (!cleanRuc) return;

  const supabase = createAdminClient();

  try {
    await supabase.from("suppliers").upsert(
      {
        ruc: cleanRuc,
        razon_social: params.razon_social || cleanRuc,
        default_group_code: params.group_code || null,
        default_group_name: params.group_name || null,
        default_account_code: params.account_code,
        default_account_name: params.account_name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ruc" }
    );
  } catch (err) {
    console.warn("No se pudo guardar la memoria del proveedor en suppliers:", err);
  }
}
