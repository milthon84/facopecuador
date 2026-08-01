"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { logAudit } from "@/lib/audit";
import { createMonthlyClosingJournalEntry, voidMonthlyClosingJournalEntry } from "@/lib/accounting";

export async function executeMonthlyCloseAction(formData: FormData) {
  await assertWritePermission("/erp/contabilidad");

  const period = formData.get("period") as string;
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Período inválido");
  }

  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();

  const [year, month] = period.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to   = new Date(year, month, 0).toISOString().split("T")[0];

  // Cargar todos los asientos posteados del mes
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*, lines:journal_lines(*)")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .eq("status", "posted");

  const allEntries = entries ?? [];
  const allLines = allEntries.flatMap((e: any) => e.lines ?? []);

  // Agrupar por cuenta de Ingresos (4.x) y Gastos (5.x)
  const incomeMap: Record<string, { code: string; name: string; amount: number }> = {};
  const expenseMap: Record<string, { code: string; name: string; amount: number }> = {};

  for (const l of allLines) {
    if (l.account_code.startsWith("4.")) {
      if (!incomeMap[l.account_code]) {
        incomeMap[l.account_code] = { code: l.account_code, name: l.account_name, amount: 0 };
      }
      incomeMap[l.account_code].amount += Number(l.credit) - Number(l.debit);
    } else if (l.account_code.startsWith("5.")) {
      if (!expenseMap[l.account_code]) {
        expenseMap[l.account_code] = { code: l.account_code, name: l.account_name, amount: 0 };
      }
      expenseMap[l.account_code].amount += Number(l.debit) - Number(l.credit);
    }
  }

  const incomeLines = Object.values(incomeMap).filter(i => i.amount > 0);
  const expenseLines = Object.values(expenseMap).filter(e => e.amount > 0);

  const totalIncome = incomeLines.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenseLines.reduce((s, e) => s + e.amount, 0);
  const netProfit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Generar asiento de cierre
  const closingEntryId = await createMonthlyClosingJournalEntry({
    period,
    closing_date: to,
    incomeLines,
    expenseLines,
    net_profit: netProfit,
    user_id: user?.id,
    user_email: user?.email,
  });

  // Guardar o actualizar registro de cierre
  const { data: closureRecord, error: closureError } = await supabase
    .from("monthly_closures")
    .upsert({
      period,
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_id: user?.id ?? null,
      closed_by_email: user?.email ?? null,
      closing_entry_id: closingEntryId,
      total_income: Math.round(totalIncome * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net_profit: netProfit,
      updated_at: new Date().toISOString(),
    }, { onConflict: "period" })
    .select()
    .single();

  if (closureError || !closureRecord) {
    throw new Error("Error registrando cierre en BD: " + closureError?.message);
  }

  // Registrar en bitácora inmutable de cierres
  await supabase.from("monthly_closure_logs").insert({
    closure_id: closureRecord.id,
    period,
    action: "close",
    executed_by_id: user?.id ?? null,
    executed_by_email: user?.email ?? null,
    reason: `Cierre automático del período ${period}`,
    closing_entry_id: closingEntryId,
    total_income: Math.round(totalIncome * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    net_profit: netProfit,
  });

  // Auditoría del sistema
  const sessionRole = (user?.app_metadata?.role as string) ?? "admin";
  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: sessionRole,
    action: "update",
    resource: "monthly_closure",
    resource_id: closureRecord.id,
    description: `Cierre contable ejecutado para el período ${period}. Ingresos: $${totalIncome.toFixed(2)}, Gastos: $${totalExpenses.toFixed(2)}, Utilidad: $${netProfit.toFixed(2)}`,
    metadata: { period, totalIncome, totalExpenses, netProfit, closingEntryId },
  });

  revalidatePath("/erp/contabilidad");
  revalidatePath("/erp/contabilidad/cierre");
}

export async function reopenMonthlyPeriodAction(formData: FormData) {
  await assertWritePermission("/erp/contabilidad");

  const period = formData.get("period") as string;
  const reason = (formData.get("reason") as string)?.trim();

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Período inválido");
  }

  if (!reason || reason.length < 5) {
    throw new Error("Debes proporcionar una justificación clara para la reapertura del mes (mínimo 5 caracteres).");
  }

  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();

  // Buscar registro de cierre existente
  const { data: closure } = await supabase
    .from("monthly_closures")
    .select("*")
    .eq("period", period)
    .single();

  if (!closure) {
    throw new Error("El período seleccionado no cuenta con un cierre registrado.");
  }

  // Anular el asiento de cierre si existe
  if (closure.closing_entry_id) {
    try {
      await voidMonthlyClosingJournalEntry(closure.closing_entry_id);
    } catch (err) {
      console.error("Error al anular el asiento de cierre:", err);
    }
  }

  // Actualizar estado del cierre a reopened
  const { error: updateError } = await supabase
    .from("monthly_closures")
    .update({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopened_by_id: user?.id ?? null,
      reopened_by_email: user?.email ?? null,
      reopen_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", closure.id);

  if (updateError) {
    throw new Error("Error actualizando reapertura en BD: " + updateError.message);
  }

  // Registrar en bitácora de cierres
  await supabase.from("monthly_closure_logs").insert({
    closure_id: closure.id,
    period,
    action: "reopen",
    executed_by_id: user?.id ?? null,
    executed_by_email: user?.email ?? null,
    reason,
    closing_entry_id: closure.closing_entry_id,
    total_income: closure.total_income,
    total_expenses: closure.total_expenses,
    net_profit: closure.net_profit,
  });

  // Auditoría del sistema
  const sessionRole = (user?.app_metadata?.role as string) ?? "admin";
  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: sessionRole,
    action: "update",
    resource: "monthly_closure",
    resource_id: closure.id,
    description: `Reapertura del período contable ${period}. Motivo de corrección: "${reason}"`,
    metadata: { period, reason, previous_closing_entry_id: closure.closing_entry_id },
  });

  revalidatePath("/erp/contabilidad");
  revalidatePath("/erp/contabilidad/cierre");
}
