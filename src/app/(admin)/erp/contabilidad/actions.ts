"use server";

import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { syncPeriodExpensesJournalEntries, syncPeriodInvoicesJournalEntries } from "@/lib/accounting";

export async function syncPeriodExpensesAction(period: string) {
  try {
    await assertWritePermission("/erp/contabilidad");
    const [expRes, invRes] = await Promise.all([
      syncPeriodExpensesJournalEntries(period),
      syncPeriodInvoicesJournalEntries(period),
    ]);
    revalidatePath("/erp/contabilidad");
    revalidatePath("/erp/gastos");
    revalidatePath("/erp/facturacion");
    return { success: true, count: (expRes?.count || 0) + (invRes?.count || 0) };
  } catch (err: any) {
    console.error("Error en syncPeriodExpensesAction:", err);
    return { success: false, error: err.message || "Error al sincronizar asientos" };
  }
}
