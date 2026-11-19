"use server";

import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import {
  syncPeriodExpensesJournalEntries,
  syncPeriodInvoicesJournalEntries,
  createManualJournalEntry,
  deleteManualJournalEntry,
} from "@/lib/accounting";

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

export type ManualJournalLineItem = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description?: string;
};

export type CreateManualJournalEntryInput = {
  entry_date: string;
  description: string;
  reference?: string;
  lines: ManualJournalLineItem[];
};

export async function createManualJournalEntryAction(data: CreateManualJournalEntryInput) {
  try {
    const user = await assertWritePermission("/erp/contabilidad");
    const entryId = await createManualJournalEntry({
      entry_date: data.entry_date,
      description: data.description,
      reference: data.reference,
      lines: data.lines,
      user_id: user?.id,
      user_email: user?.email,
    });

    revalidatePath("/erp/contabilidad");
    revalidatePath("/erp/contabilidad/mayor");
    revalidatePath("/erp/contabilidad/balance");
    revalidatePath("/erp/contabilidad/resultados");
    revalidatePath("/erp/activos");
    revalidatePath("/erp/activos/reporte");
    return { success: true, id: entryId };
  } catch (err: any) {
    console.error("Error en createManualJournalEntryAction:", err);
    return { success: false, error: err.message || "Error al registrar el asiento manual." };
  }
}

export async function deleteManualJournalEntryAction(entryId: string) {
  try {
    await assertWritePermission("/erp/contabilidad");
    await deleteManualJournalEntry(entryId);

    revalidatePath("/erp/contabilidad");
    revalidatePath("/erp/contabilidad/mayor");
    revalidatePath("/erp/contabilidad/balance");
    revalidatePath("/erp/contabilidad/resultados");
    revalidatePath("/erp/activos");
    revalidatePath("/erp/activos/reporte");
    return { success: true };
  } catch (err: any) {
    console.error("Error en deleteManualJournalEntryAction:", err);
    return { success: false, error: err.message || "Error al eliminar el asiento manual." };
  }
}
