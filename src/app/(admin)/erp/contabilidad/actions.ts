"use server";

import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { syncPeriodExpensesJournalEntries } from "@/lib/accounting";

export async function syncPeriodExpensesAction(period: string) {
  try {
    await assertWritePermission("/erp/contabilidad");
    const res = await syncPeriodExpensesJournalEntries(period);
    revalidatePath("/erp/contabilidad");
    revalidatePath("/erp/gastos");
    return { success: true, count: res.count };
  } catch (err: any) {
    console.error("Error en syncPeriodExpensesAction:", err);
    return { success: false, error: err.message || "Error al sincronizar asientos" };
  }
}
