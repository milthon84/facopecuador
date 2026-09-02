/**
 * Módulo de Contabilidad — Generador de Asientos NIIF
 * Doble partida: suma de débitos siempre = suma de créditos
 */

import { createAdminClient } from "@/lib/supabase/admin";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Mapeo: categoría de gasto → cuenta contable ────────────────────────────
const EXPENSE_CATEGORY_ACCOUNT: Record<string, { code: string; name: string }> = {
  "Insumos dentales":    { code: "5.1.01", name: "Insumos y Materiales Clínicos" },
  "Equipos":             { code: "5.2.04", name: "Mantenimiento Equipos e Instalaciones" },
  "Arriendo":            { code: "5.2.02", name: "Arriendo del Local / Consultorio" },
  "Servicios básicos":   { code: "5.2.03", name: "Servicios Básicos (Luz, Agua, Internet)" },
  "Salarios":            { code: "5.2.01", name: "Sueldos, Salarios y Beneficios" },
  "Suministros oficina": { code: "5.2.05", name: "Suministros Oficina y Aseo" },
  "Mantenimiento":       { code: "5.2.04", name: "Mantenimiento Equipos e Instalaciones" },
  "Publicidad":          { code: "5.2.06", name: "Publicidad, Marketing y Comisiones" },
  "Otros":               { code: "5.2.09", name: "Impuestos, Tasas y Otros Gastos" },
};

// ── Mapeo: forma de pago del gasto → cuenta de contrapartida ──────────────
function paymentAccount(method: string): { code: string; name: string } {
  if (method === "credito") return { code: "2.1.01.01", name: "Cuentas por Pagar Proveedores" };
  if (method === "transferencia") return { code: "1.1.01.03", name: "Bancos Cuentas Corrientes y Ahorros" };
  return { code: "1.1.01.03", name: "Bancos Cuentas Corrientes y Ahorros" }; // efectivo y tarjeta → bancos
}

// ── Tipo para una línea del asiento ───────────────────────────────────────
interface JournalLine {
  account_code: string;
  account_name: string;
  debit:        number;
  credit:       number;
  description?: string;
}

// ── Insertar asiento completo ──────────────────────────────────────────────
async function insertJournalEntry(params: {
  entry_date:      string;
  description:     string;
  reference_type:  "invoice" | "expense" | "manual" | "asset_purchase" | "depreciation" | "disposal" | "monthly_closure";
  reference_id?:   string | null;
  lines:           JournalLine[];
  user_id?:        string | null;
  user_email?:     string | null;
}) {
  const supabase = createAdminClient();

  // Validar cuadre (débitos = créditos)
  const totalDebit  = r2(params.lines.reduce((s, l) => s + l.debit,  0));
  const totalCredit = r2(params.lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit !== totalCredit) {
    throw new Error(`Asiento descuadrado: débitos ${totalDebit} ≠ créditos ${totalCredit}`);
  }

  const { data: entry, error } = await supabase
    .from("journal_entries")
    .insert({
      entry_date:      params.entry_date,
      description:     params.description,
      reference_type:  params.reference_type,
      reference_id:    params.reference_id ?? null,
      status:          "posted",
      created_by_id:   params.user_id   ?? null,
      created_by_email: params.user_email ?? null,
    })
    .select()
    .single();

  if (error || !entry) throw new Error("Error creando asiento: " + error?.message);

  await supabase.from("journal_lines").insert(
    params.lines.map(l => ({
      journal_entry_id: entry.id,
      account_code:     l.account_code,
      account_name:     l.account_name,
      debit:            l.debit,
      credit:           l.credit,
      description:      l.description ?? null,
    }))
  );

  return entry.id;
}

// ── Asiento por Factura de Venta ───────────────────────────────────────────
/**
 * Factura emitida al cliente:
 *   Dr. Cuentas por Cobrar Clientes   (total)
 *   Cr.   Servicios Odontológicos     (subtotal sin IVA)
 *   Cr.   IVA en Ventas por Pagar     (iva_amount)   ← solo si hay IVA
 */
export async function createInvoiceJournalEntry(params: {
  invoice_id:   string;
  invoice_date: string;
  client_name:  string;
  subtotal_0:   number;
  subtotal_15:  number;
  iva_amount:   number;
  total:        number;
  user_id?:     string | null;
  user_email?:  string | null;
}) {
  const subtotalTotal = r2(params.subtotal_0 + params.subtotal_15);
  const lines: JournalLine[] = [
    {
      account_code: "1.1.02.01",
      account_name: "Cuentas por Cobrar Pacientes (Clínica)",
      debit:  r2(params.total),
      credit: 0,
      description: params.client_name,
    },
    {
      account_code: "4.1.01",
      account_name: "Servicios de Prevención e Higiene", // Generic default fallback for invoice
      debit:  0,
      credit: subtotalTotal,
    },
  ];

  if (params.iva_amount > 0) {
    lines.push({
      account_code: "2.1.03.01",
      account_name: "IVA en Ventas por Pagar",
      debit:  0,
      credit: r2(params.iva_amount),
    });
  }

  return insertJournalEntry({
    entry_date:     params.invoice_date,
    description:    `Factura de venta — ${params.client_name}`,
    reference_type: "invoice",
    reference_id:   params.invoice_id,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}

// ── Asiento por Gasto / Factura de Compra ─────────────────────────────────
/**
 * Gasto registrado:
 *   Dr. Cuenta de Gasto               (subtotal_0 + subtotal_15)
 *   Dr. Crédito Tributario IVA        (iva_amount)   ← solo si hay IVA
 *   Cr.   Bancos / Ctas. por Pagar    (total)
 */
export async function createExpenseJournalEntry(params: {
  expense_id:      string;
  expense_date:    string;
  supplier_name:   string;
  category:        string;
  payment_method:  string;
  subtotal_0:      number;
  subtotal_15:     number;
  iva_amount:      number;
  total:           number;
  user_id?:        string | null;
  user_email?:     string | null;
}) {
  const expenseAccount = EXPENSE_CATEGORY_ACCOUNT[params.category]
    ?? EXPENSE_CATEGORY_ACCOUNT["Otros"];
  const contraAccount  = paymentAccount(params.payment_method);
  const subtotalTotal  = r2(params.subtotal_0 + params.subtotal_15);

  const lines: JournalLine[] = [
    {
      account_code: expenseAccount.code,
      account_name: expenseAccount.name,
      debit:  subtotalTotal,
      credit: 0,
      description: params.supplier_name,
    },
  ];

  if (params.iva_amount > 0) {
    lines.push({
      account_code: "1.1.03.01",
      account_name: "Crédito Tributario IVA",
      debit:  r2(params.iva_amount),
      credit: 0,
    });
  }

  lines.push({
    account_code: contraAccount.code,
    account_name: contraAccount.name,
    debit:  0,
    credit: r2(params.total),
    description: params.supplier_name,
  });

  return insertJournalEntry({
    entry_date:     params.expense_date,
    description:    `Gasto — ${params.category} — ${params.supplier_name}`,
    reference_type: "expense",
    reference_id:   params.expense_id,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}

// ── Mapeo: categoría de activo → cuentas contables ────────────────────────
const ASSET_ACCOUNTS: Record<string, { asset: string; assetName: string; dep: string; depName: string; depExp: string; depExpName: string }> = {
  "Equipos odontológicos":      { asset: "1.2.01.01", assetName: "Equipos Médicos y Odontológicos", dep: "1.2.02.01", depName: "Deprec. Acum. Equipos Médicos", depExp: "5.2.08", depExpName: "Depreciaciones" },
  "Muebles y enseres":          { asset: "1.2.01.02", assetName: "Mobiliario y Enseres",            dep: "1.2.02.02", depName: "Deprec. Acum. Mobiliario",      depExp: "5.2.08", depExpName: "Depreciaciones" },
  "Equipos de computación":     { asset: "1.2.01.03", assetName: "Equipos de Computación y Software",dep: "1.2.02.03", depName: "Deprec. Acum. Computación",      depExp: "5.2.08", depExpName: "Depreciaciones" },
  "Otros equipos y maquinaria": { asset: "1.2.01.01", assetName: "Equipos Médicos y Odontológicos", dep: "1.2.02.01", depName: "Deprec. Acum. Equipos Médicos", depExp: "5.2.08", depExpName: "Depreciaciones" },
};

function assetAccounts(category: string) {
  return ASSET_ACCOUNTS[category] ?? ASSET_ACCOUNTS["Otros equipos y maquinaria"];
}

// ── Asiento: Compra de Activo Fijo ────────────────────────────────────────
export async function createAssetPurchaseJournalEntry(params: {
  asset_id:       string;
  purchase_date:  string;
  asset_name:     string;
  category:       string;
  purchase_value: number;
  on_credit:      boolean;
  user_id?:       string | null;
  user_email?:    string | null;
}) {
  const accts = assetAccounts(params.category);
  const creditAcct = params.on_credit
    ? { code: "2.1.01.01", name: "Cuentas por Pagar Proveedores" }
    : { code: "1.1.01.03", name: "Bancos Cuentas Corrientes y Ahorros" };

  return insertJournalEntry({
    entry_date:     params.purchase_date,
    description:    `Compra Activo Fijo — ${params.asset_name}`,
    reference_type: "asset_purchase",
    reference_id:   params.asset_id,
    lines: [
      { account_code: accts.asset,   account_name: accts.assetName, debit: r2(params.purchase_value), credit: 0, description: params.asset_name },
      { account_code: creditAcct.code, account_name: creditAcct.name, debit: 0, credit: r2(params.purchase_value) },
    ],
    user_id:    params.user_id,
    user_email: params.user_email,
  });
}

// ── Asiento: Depreciación Mensual ─────────────────────────────────────────
export async function createDepreciationJournalEntry(params: {
  asset_id:       string;
  asset_name:     string;
  category:       string;
  period:         string;   // 'YYYY-MM'
  monthly_amount: number;
  user_id?:       string | null;
  user_email?:    string | null;
}) {
  const accts = assetAccounts(params.category);

  return insertJournalEntry({
    entry_date:     `${params.period}-01`,
    description:    `Depreciación ${params.period} — ${params.asset_name}`,
    reference_type: "depreciation",
    reference_id:   params.asset_id,
    lines: [
      { account_code: accts.depExp, account_name: accts.depExpName, debit: r2(params.monthly_amount), credit: 0, description: `Dep. ${params.period}` },
      { account_code: accts.dep,    account_name: accts.depName,    debit: 0, credit: r2(params.monthly_amount) },
    ],
    user_id:    params.user_id,
    user_email: params.user_email,
  });
}

// ── Asiento: Cierre Mensual Contable (Liquidador de Cuentas de Resultado) ──
export async function createMonthlyClosingJournalEntry(params: {
  period:       string;   // 'YYYY-MM'
  closing_date: string;   // 'YYYY-MM-DD'
  incomeLines:  { code: string; name: string; amount: number }[];
  expenseLines: { code: string; name: string; amount: number }[];
  net_profit:   number;
  user_id?:     string | null;
  user_email?:  string | null;
}) {
  const lines: JournalLine[] = [];

  // 1. Cancelar Cuentas de Ingreso (Débito)
  for (const inc of params.incomeLines) {
    if (inc.amount > 0) {
      lines.push({
        account_code: inc.code,
        account_name: inc.name,
        debit:  r2(inc.amount),
        credit: 0,
        description: `Cierre Ingresos ${params.period}`,
      });
    }
  }

  // 2. Si hay pérdida, debitar a Utilidad/Pérdida del Ejercicio
  if (params.net_profit < 0) {
    lines.push({
      account_code: "3.3.02",
      account_name: "Utilidad o Pérdida del Ejercicio",
      debit:  r2(Math.abs(params.net_profit)),
      credit: 0,
      description: `Pérdida del Período ${params.period}`,
    });
  }

  // 3. Cancelar Cuentas de Gasto (Crédito)
  for (const exp of params.expenseLines) {
    if (exp.amount > 0) {
      lines.push({
        account_code: exp.code,
        account_name: exp.name,
        debit:  0,
        credit: r2(exp.amount),
        description: `Cierre Gastos ${params.period}`,
      });
    }
  }

  // 4. Si hay utilidad, me acreditar a Utilidad/Pérdida del Ejercicio
  if (params.net_profit > 0) {
    lines.push({
      account_code: "3.3.02",
      account_name: "Utilidad o Pérdida del Ejercicio",
      debit:  0,
      credit: r2(params.net_profit),
      description: `Utilidad del Período ${params.period}`,
    });
  }

  return insertJournalEntry({
    entry_date:     params.closing_date,
    description:    `Asiento de Cierre Contable — Período ${params.period}`,
    reference_type: "manual",
    reference_id:   null,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}

// ── Anular Asiento de Cierre Contable ─────────────────────────────────────
export async function voidMonthlyClosingJournalEntry(entryId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("journal_entries")
    .update({ status: "void" })
    .eq("id", entryId);
}

// ── Validar Cierre de Mes ──────────────────────────────────────────────────
export async function isMonthClosed(dateStr: string): Promise<boolean> {
  if (!dateStr) return false;
  const period = dateStr.slice(0, 7); // "YYYY-MM"
  const year = dateStr.slice(0, 4);   // "YYYY"
  const supabase = createAdminClient();

  const [{ data: monthly }, { data: annual }] = await Promise.all([
    supabase.from("monthly_closures").select("status").eq("period", period).maybeSingle(),
    supabase.from("annual_closures").select("status").eq("year", year).maybeSingle(),
  ]);

  return monthly?.status === "closed" || annual?.status === "closed";
}

export async function assertMonthOpen(dateStr: string): Promise<void> {
  if (!dateStr) return;
  const closed = await isMonthClosed(dateStr);
  if (closed) {
    const period = dateStr.slice(0, 7);
    const [y, m] = period.split("-");
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" });
    throw new Error(`El período contable ${monthName} (${period}) se encuentra CERRADO. No es posible registrar ni modificar gastos o facturas en un mes cerrado. Reabre el mes en Contabilidad si requieres realizar ajustes.`);
  }
}

// ── Asiento: Cierre Anual Fiscal / Contable ────────────────────────────────
export async function createAnnualClosingJournalEntry(params: {
  year:                    number;
  closing_date:            string; // 'YYYY-12-31'
  incomeLines:             { code: string; name: string; amount: number }[];
  expenseLines:            { code: string; name: string; amount: number }[];
  gross_profit:            number;
  employee_profit_sharing: number;
  income_tax:              number;
  net_profit:              number;
  user_id?:                string | null;
  user_email?:             string | null;
}) {
  const lines: JournalLine[] = [];

  // 1. Cancelar Cuentas de Ingreso acumuladas del año (Débito)
  for (const inc of params.incomeLines) {
    if (inc.amount > 0) {
      lines.push({
        account_code: inc.code,
        account_name: inc.name,
        debit:  r2(inc.amount),
        credit: 0,
        description: `Cierre Anual Ingresos ${params.year}`,
      });
    }
  }

  // 2. Si hay pérdida bruta en el año, debitar a Utilidad/Pérdida del Ejercicio
  if (params.gross_profit < 0) {
    lines.push({
      account_code: "3.2.02",
      account_name: "Utilidad / Pérdida del Ejercicio",
      debit:  r2(Math.abs(params.gross_profit)),
      credit: 0,
      description: `Pérdida Neta del Ejercicio ${params.year}`,
    });
  }

  // 3. Cancelar Cuentas de Gasto acumuladas del año (Crédito)
  for (const exp of params.expenseLines) {
    if (exp.amount > 0) {
      lines.push({
        account_code: exp.code,
        account_name: exp.name,
        debit:  0,
        credit: r2(exp.amount),
        description: `Cierre Anual Gastos ${params.year}`,
      });
    }
  }

  // 4. Si hay utilidad positiva: acreditar Pasivos de Impuestos/Trabajadores y Utilidad Neta a Patrimonio
  if (params.gross_profit > 0) {
    if (params.employee_profit_sharing > 0) {
      lines.push({
        account_code: "2.1.02.03",
        account_name: "15% Participación Trabajadores",
        debit:  0,
        credit: r2(params.employee_profit_sharing),
        description: `15% Utilidad Trabajadores ${params.year}`,
      });
    }

    if (params.income_tax > 0) {
      lines.push({
        account_code: "2.1.03.03",
        account_name: "Impuesto a la Renta por Pagar",
        debit:  0,
        credit: r2(params.income_tax),
        description: `Impuesto a la Renta SRI ${params.year}`,
      });
    }

    if (params.net_profit > 0) {
      lines.push({
        account_code: "3.3.02",
        account_name: "Utilidad o Pérdida del Ejercicio",
        debit:  0,
        credit: r2(params.net_profit),
        description: `Utilidad Neta del Ejercicio ${params.year}`,
      });
    }
  }

  return insertJournalEntry({
    entry_date:     params.closing_date,
    description:    `Asiento de Cierre Anual Fiscal y Contable — Ejercicio ${params.year}`,
    reference_type: "manual",
    reference_id:   null,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}
