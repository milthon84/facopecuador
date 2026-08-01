"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { assertWritePermission } from "@/lib/auth-action";
import { logAudit } from "@/lib/audit";
import { createAnnualClosingJournalEntry, voidMonthlyClosingJournalEntry } from "@/lib/accounting";

export async function executeAnnualCloseAction(formData: FormData) {
  await assertWritePermission("/erp/contabilidad");

  const yearNum = Number(formData.get("year"));
  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    throw new Error("Año fiscal inválido");
  }

  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();

  const from = `${yearNum}-01-01`;
  const to   = `${yearNum}-12-31`;

  // Cargar todos los asientos del año
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
  const grossProfit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Liquidación Fiscal Ecuador: 15% Trabajadores + 25% Impuesto Renta
  let employeeProfitSharing = 0;
  let incomeTax = 0;
  let netProfit = grossProfit;

  if (grossProfit > 0) {
    employeeProfitSharing = Math.round(grossProfit * 0.15 * 100) / 100;
    const taxableProfit   = Math.round((grossProfit - employeeProfitSharing) * 100) / 100;
    incomeTax             = Math.round(taxableProfit * 0.25 * 100) / 100;
    netProfit             = Math.round((taxableProfit - incomeTax) * 100) / 100;
  }

  // Generar asiento de cierre anual
  const closingEntryId = await createAnnualClosingJournalEntry({
    year: yearNum,
    closing_date: to,
    incomeLines,
    expenseLines,
    gross_profit: grossProfit,
    employee_profit_sharing: employeeProfitSharing,
    income_tax: incomeTax,
    net_profit: netProfit,
    user_id: user?.id,
    user_email: user?.email,
  });

  // Guardar en annual_closures
  const { data: closureRecord, error: closureError } = await supabase
    .from("annual_closures")
    .upsert({
      year: yearNum,
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_id: user?.id ?? null,
      closed_by_email: user?.email ?? null,
      closing_entry_id: closingEntryId,
      total_income: Math.round(totalIncome * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      gross_profit: grossProfit,
      employee_profit_sharing: employeeProfitSharing,
      income_tax: incomeTax,
      net_profit: netProfit,
      updated_at: new Date().toISOString(),
    }, { onConflict: "year" })
    .select()
    .single();

  if (closureError || !closureRecord) {
    throw new Error("Error guardando cierre anual en BD: " + closureError?.message);
  }

  // Bloquear automáticamente todos los 12 meses del ejercicio fiscal
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${yearNum}-${String(m).padStart(2, "0")}`;
    await supabase.from("monthly_closures").upsert({
      period: monthStr,
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_id: user?.id ?? null,
      closed_by_email: user?.email ?? null,
      closing_entry_id: closingEntryId,
      total_income: Math.round(totalIncome * 100) / 100,
      total_expenses: Math.round(totalExpenses * 100) / 100,
      net_profit: netProfit,
      updated_at: new Date().toISOString(),
    }, { onConflict: "period" });
  }

  // Registrar en bitácora de cierres anuales
  await supabase.from("annual_closure_logs").insert({
    annual_closure_id: closureRecord.id,
    year: yearNum,
    action: "close",
    executed_by_id: user?.id ?? null,
    executed_by_email: user?.email ?? null,
    reason: `Cierre Anual Fiscal Oficial del Ejercicio ${yearNum}`,
    closing_entry_id: closingEntryId,
    total_income: Math.round(totalIncome * 100) / 100,
    total_expenses: Math.round(totalExpenses * 100) / 100,
    gross_profit: grossProfit,
    employee_profit_sharing: employeeProfitSharing,
    income_tax: incomeTax,
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
    description: `Cierre Anual Fiscal ejecutado para el ejercicio ${yearNum}. Utilidad Bruta: $${grossProfit.toFixed(2)}, 15% Trab: $${employeeProfitSharing.toFixed(2)}, 25% IR: $${incomeTax.toFixed(2)}, Utilidad Neta: $${netProfit.toFixed(2)}`,
    metadata: { year: yearNum, grossProfit, employeeProfitSharing, incomeTax, netProfit, closingEntryId },
  });

  revalidatePath("/erp/contabilidad");
  revalidatePath("/erp/contabilidad/cierre");
  revalidatePath("/erp/contabilidad/cierre-anual");
}

export async function reopenAnnualPeriodAction(formData: FormData) {
  await assertWritePermission("/erp/contabilidad");

  const yearNum = Number(formData.get("year"));
  const reason = (formData.get("reason") as string)?.trim();

  if (!yearNum || yearNum < 2000 || yearNum > 2100) {
    throw new Error("Año fiscal inválido");
  }

  if (!reason || reason.length < 5) {
    throw new Error("Debes ingresar un motivo o justificación clara para reabrir el ejercicio fiscal.");
  }

  const supabase = createAdminClient();
  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();

  const { data: closure } = await supabase
    .from("annual_closures")
    .select("*")
    .eq("year", yearNum)
    .single();

  if (!closure) {
    throw new Error("No existe un cierre anual registrado para el año " + yearNum);
  }

  // Anular asiento contable de cierre anual previo
  if (closure.closing_entry_id) {
    try {
      await voidMonthlyClosingJournalEntry(closure.closing_entry_id);
    } catch (err) {
      console.error("Error anulando asiento de cierre anual:", err);
    }
  }

  // Actualizar estado del año a reopened
  await supabase
    .from("annual_closures")
    .update({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopened_by_id: user?.id ?? null,
      reopened_by_email: user?.email ?? null,
      reopen_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", closure.id);

  // Registrar en bitácora de cierres anuales
  await supabase.from("annual_closure_logs").insert({
    annual_closure_id: closure.id,
    year: yearNum,
    action: "reopen",
    executed_by_id: user?.id ?? null,
    executed_by_email: user?.email ?? null,
    reason,
    closing_entry_id: closure.closing_entry_id,
    total_income: closure.total_income,
    total_expenses: closure.total_expenses,
    gross_profit: closure.gross_profit,
    employee_profit_sharing: closure.employee_profit_sharing,
    income_tax: closure.income_tax,
    net_profit: closure.net_profit,
  });

  // Reabrir los 12 meses del ejercicio fiscal
  for (let m = 1; m <= 12; m++) {
    const monthStr = `${yearNum}-${String(m).padStart(2, "0")}`;
    await supabase.from("monthly_closures").update({
      status: "reopened",
      reopened_at: new Date().toISOString(),
      reopened_by_id: user?.id ?? null,
      reopened_by_email: user?.email ?? null,
      reopen_reason: `Reapertura por Cierre Anual: ${reason}`,
      updated_at: new Date().toISOString(),
    }).eq("period", monthStr);
  }

  // Auditoría
  const sessionRole = (user?.app_metadata?.role as string) ?? "admin";
  await logAudit({
    user_id: user?.id,
    user_email: user?.email,
    user_role: sessionRole,
    action: "update",
    resource: "monthly_closure",
    resource_id: closure.id,
    description: `Reapertura del Ejercicio Fiscal ${yearNum}. Motivo: "${reason}"`,
    metadata: { year: yearNum, reason, previous_closing_entry_id: closure.closing_entry_id },
  });

  revalidatePath("/erp/contabilidad");
  revalidatePath("/erp/contabilidad/cierre");
  revalidatePath("/erp/contabilidad/cierre-anual");
}
