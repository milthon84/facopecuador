/**
 * Módulo de Contabilidad — Generador de Asientos NIIF
 * Doble partida: suma de débitos siempre = suma de créditos
 */

import { createAdminClient } from "@/lib/supabase/admin";

const r2 = (n: number) => Math.round(n * 100) / 100;

// ── Mapeo: categoría de gasto → cuenta contable (SIEMPRE cuentas de MOVIMIENTO) ──────────────────
//   ⚠️  REGLA CONTABLE NIIF: Nunca se imputa a cuentas de Grupo (nodos intermedios del plan).
//       Toda línea de asiento debe apuntar a una cuenta hija de movimiento (4 segmentos).
export const EXPENSE_CATEGORY_ACCOUNT: Record<string, { code: string; name: string }> = {
  // ── 6 Categorías principales → cuentas hijas de movimiento ──────────────
  "Insumo y Material":         { code: "5.1.01.01", name: "Insumos Dentales Utilizados" },
  "Suministro":                { code: "5.2.05.01", name: "Útiles de Oficina" },
  "Activo fijo":               { code: "1.2.01.01", name: "Equipos Médicos y Odontológicos" },
  "Servicio":                  { code: "5.2.03.01", name: "Energía Eléctrica" },
  "Software y Licencias":      { code: "1.2.01.03", name: "Equipos de Computación y Software" },
  "Otros Gastos":              { code: "5.2.19.01", name: "Alimentación Cafetería" },

  // ── Alias / compatibilidad con categorías anteriores ───────────────────
  "Materiales e Instrumental": { code: "5.1.01.01", name: "Insumos Dentales Utilizados" },
  "Insumos dentales":          { code: "5.1.01.01", name: "Insumos Dentales Utilizados" },
  "Equipos":                   { code: "1.2.01.01", name: "Equipos Médicos y Odontológicos" },
  "Arriendo":                  { code: "5.2.02.01", name: "Arriendo de Local" },
  "Servicios básicos":         { code: "5.2.03.01", name: "Energía Eléctrica" },
  "Salarios":                  { code: "5.2.01.01", name: "Sueldos y Salarios" },
  "Suministros oficina":       { code: "5.2.05.01", name: "Útiles de Oficina" },
  "Mantenimiento":             { code: "5.2.04.01", name: "Mantenimiento Instalaciones/Adecuaciones" },
  "Publicidad":                { code: "5.2.06.01", name: "Publicidad y Marketing" },
  "Seguros y Suscripciones":   { code: "5.2.10.01", name: "Seguro" },
  "Otros":                     { code: "5.2.19.01", name: "Alimentación Cafetería" },
};

// ── Mapeo: forma de pago del gasto → cuenta de contrapartida ──────────────
function paymentAccount(method: string): { code: string; name: string } {
  if (method === "credito") return { code: "2.1.01.01", name: "Cuentas por Pagar Proveedores" };
  if (method === "prestamo_accionistas") return { code: "2.1.05.01", name: "Préstamos Accionistas por Pagar" };
  if (method === "efectivo") return { code: "1.1.01.02", name: "Caja Chica" };
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

// ── Cuentas de GRUPO que nunca deben recibir imputaciones directas ──────────
// Regla NIIF: solo las cuentas hijas (is_movement = true) admiten débitos/créditos.
const FORBIDDEN_GROUP_CODES = new Set([
  "5.1.01","5.1.02","5.1.03","5.1.04","5.1.05",
  "5.2.01","5.2.02","5.2.03","5.2.04","5.2.05",
  "5.2.06","5.2.07","5.2.08","5.2.09","5.2.10",
  "5.2.11","5.2.19","5.4","5.4.01",
  "4.1.01","4.1.02","4.1.03","4.1.04",
  "4.2.01","4.3.01","4.4.01",
]);

// ── Insertar asiento completo ──────────────────────────────────────────────
async function insertJournalEntry(params: {
  entry_date:      string;
  description:     string;
  reference_type:  "invoice" | "expense" | "manual" | "asset_purchase" | "depreciation" | "disposal" | "monthly_closure" | "credit_note";
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

  // ⚠️ Validar que ninguna línea impute a una cuenta de GRUPO
  for (const line of params.lines) {
    if (FORBIDDEN_GROUP_CODES.has(line.account_code)) {
      throw new Error(
        `Error contable: La cuenta "${line.account_code} — ${line.account_name}" es una cuenta de GRUPO ` +
        `y no puede recibir imputaciones directas. Use la cuenta hija correspondiente.`
      );
    }
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
 *   Dr. Cuentas por Cobrar (Clínica / Cursos / Coworking / Otros) (total)
 *   Cr.   Ingreso correspondiente                                (subtotal sin IVA)
 *   Cr.   IVA en Ventas por Pagar                                (iva_amount)   ← solo si hay IVA
 */
export async function createInvoiceJournalEntry(params: {
  invoice_id:   string;
  invoice_date: string;
  client_name:  string;
  subtotal_0:   number;
  subtotal_15:  number;
  iva_amount:   number;
  total:        number;
  billing_area?: "clinica" | "cursos" | "coworking" | "otros" | string | null;
  user_id?:     string | null;
  user_email?:  string | null;
}) {
  const subtotalTotal = r2(params.subtotal_0 + params.subtotal_15);
  const area = (params.billing_area || "clinica").toLowerCase();

  let cxcAccount = {
    code: "1.1.02.01",
    name: "Cuentas por Cobrar Pacientes (Clínica)",
  };
  let incomeAccount = {
    code: "4.1.01.01",
    name: "Servicios Odontológicos",
  };

  if (area === "cursos") {
    cxcAccount = {
      code: "1.1.02.02",
      name: "Cuentas por Cobrar Alumnos (Cursos)",
    };
    incomeAccount = {
      code: "4.2.01.01",
      name: "Servicios de Capacitación y Cursos",
    };
  } else if (area === "coworking") {
    cxcAccount = {
      code: "1.1.02.03",
      name: "Cuentas por Cobrar Inquilinos (Coworking)",
    };
    incomeAccount = {
      code: "4.3.01.01",
      name: "Alquiler de Espacios y Sillones Odontológicos",
    };
  } else if (area === "otros") {
    cxcAccount = {
      code: "1.1.02.04",
      name: "Anticipos a Proveedores y Otras Ctas. por Cobrar",
    };
    incomeAccount = {
      code: "4.4.01.01",
      name: "Otros Ingresos No Operacionales",
    };
  }

  const lines: JournalLine[] = [
    {
      account_code: cxcAccount.code,
      account_name: cxcAccount.name,
      debit:  r2(params.total),
      credit: 0,
      description: params.client_name,
    },
    {
      account_code: incomeAccount.code,
      account_name: incomeAccount.name,
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
    description:    `Factura de venta (${cxcAccount.name}) — ${params.client_name}`,
    reference_type: "invoice",
    reference_id:   params.invoice_id,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}

// ── Asiento por Nota de Crédito en Ventas ─────────────────────────────────
/**
 * Nota de Crédito emitida (reversión de venta/ingreso e IVA):
 *   Dr. Servicios / Ventas            (subtotal_0 + subtotal_15)
 *   Dr. IVA en Ventas por Pagar       (iva_amount)   ← solo si hubo IVA
 *   Cr.   Cuentas por Cobrar Clientes (total)
 */
export async function createCreditNoteJournalEntry(params: {
  credit_note_id:     string;
  credit_note_number: string;
  credit_note_date:   string;
  invoice_id?:        string | null;
  invoice_number:     string;
  client_name:        string;
  subtotal_0:         number;
  subtotal_15:        number;
  iva_amount:         number;
  total:              number;
  motivo?:            string;
  user_id?:           string | null;
  user_email?:        string | null;
}) {
  const supabase = createAdminClient();

  // 1. Evitar duplicar asientos para la misma Nota de Crédito
  const { data: existingEntry } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("reference_type", "credit_note")
    .eq("reference_id", params.credit_note_id)
    .maybeSingle();

  if (existingEntry) {
    return existingEntry;
  }

  // 2. Cuentas contables por defecto NIIF
  let cxcAccount = { code: "1.1.02.01", name: "Cuentas por Cobrar Pacientes (Clínica)" };
  let revenueAccount = { code: "4.1.01", name: "Servicios de Prevención e Higiene" };
  let ivaAccount = { code: "2.1.03.01", name: "IVA en Ventas por Pagar" };

  // Si se provee la factura original, buscar su asiento para espejar y netear con exactamente las mismas cuentas
  if (params.invoice_id) {
    const { data: invEntry } = await supabase
      .from("journal_entries")
      .select("id, journal_lines(account_code, account_name, debit, credit)")
      .eq("reference_type", "invoice")
      .eq("reference_id", params.invoice_id)
      .maybeSingle();

    if (invEntry?.journal_lines) {
      for (const line of invEntry.journal_lines as any[]) {
        if (line.account_code.startsWith("1.1.02") && Number(line.debit) > 0) {
          cxcAccount = { code: line.account_code, name: line.account_name };
        } else if (line.account_code.startsWith("4.") && Number(line.credit) > 0) {
          revenueAccount = { code: line.account_code, name: line.account_name };
        } else if (
          (line.account_code.startsWith("2.1.02") || line.account_code.startsWith("2.1.03")) &&
          Number(line.credit) > 0
        ) {
          ivaAccount = { code: line.account_code, name: line.account_name };
        }
      }
    }
  }

  const subtotalTotal = r2(params.subtotal_0 + params.subtotal_15);
  const lines: JournalLine[] = [
    {
      account_code: revenueAccount.code,
      account_name: revenueAccount.name, // Ingreso reversado (Debe netea el Haber de la Factura)
      debit:  subtotalTotal,
      credit: 0,
      description: `Reversión por NC ${params.credit_note_number} — ${params.motivo || "Anulación/Modificación"}`,
    },
  ];

  if (params.iva_amount > 0) {
    lines.push({
      account_code: ivaAccount.code,
      account_name: ivaAccount.name, // Pasivo IVA reversado (Debe netea el Haber de la Factura)
      debit:  r2(params.iva_amount),
      credit: 0,
      description: `Reversión IVA NC ${params.credit_note_number}`,
    });
  }

  lines.push({
    account_code: cxcAccount.code,
    account_name: cxcAccount.name, // Cuenta por cobrar cancelada (Haber netea el Debe de la Factura)
    debit:  0,
    credit: r2(params.total),
    description: `NC ${params.credit_note_number} sobre Fac. ${params.invoice_number}`,
  });

  try {
    return await insertJournalEntry({
      entry_date:     params.credit_note_date,
      description:    `Nota de Crédito ${params.credit_note_number} — Fac. ${params.invoice_number} (${params.client_name})`,
      reference_type: "credit_note",
      reference_id:   params.credit_note_id,
      lines,
      user_id:        params.user_id,
      user_email:     params.user_email,
    });
  } catch (err: any) {
    if (err.message?.includes("reference_type") || err.message?.includes("constraint") || err.message?.includes("23514")) {
      return await insertJournalEntry({
        entry_date:     params.credit_note_date,
        description:    `Nota de Crédito ${params.credit_note_number} — Fac. ${params.invoice_number} (${params.client_name})`,
        reference_type: "manual",
        reference_id:   params.credit_note_id,
        lines,
        user_id:        params.user_id,
        user_email:     params.user_email,
      });
    }
    throw err;
  }
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
  category?:       string | null;
  account_code?:   string | null;
  account_name?:   string | null;
  payment_method:  string;
  subtotal_0:      number;
  subtotal_15:     number;
  iva_amount:      number;
  total:           number;
  user_id?:        string | null;
  user_email?:     string | null;
  items?: {
    description: string;
    category?: string | null;
    account_code?: string | null;
    account_name?: string | null;
    subtotal: number;
  }[];
}) {
  // ⚠️ En la causación de la compra/gasto, la contrapartida contable NIIF siempre es Cuentas por Pagar Proveedores
  const contraAccount  = { code: "2.1.01.01", name: "Cuentas por Pagar Proveedores" };
  const subtotalTotal  = r2(params.subtotal_0 + params.subtotal_15);
  const lines: JournalLine[] = [];

  // Si vienen ítems con sus cuentas o categorías, direccionamos contablemente cada ítem
  if (params.items && params.items.length > 0) {
    const debitsByAccount = new Map<string, { code: string; name: string; amount: number; descriptions: string[] }>();

    for (const it of params.items) {
      const itCategory = (it.category || params.category || "Otros").trim();
      let code = it.account_code || params.account_code;
      let name = it.account_name || params.account_name;

      if (!code) {
        const account = EXPENSE_CATEGORY_ACCOUNT[itCategory]
          ?? (params.category ? EXPENSE_CATEGORY_ACCOUNT[params.category] : undefined)
          ?? EXPENSE_CATEGORY_ACCOUNT["Otros"];
        code = account.code;
        name = account.name;
      }

      const amt = r2(Number(it.subtotal || 0));
      if (amt <= 0) continue;

      const existing = debitsByAccount.get(code);
      if (existing) {
        existing.amount = r2(existing.amount + amt);
        if (it.description) existing.descriptions.push(it.description);
      } else {
        debitsByAccount.set(code, {
          code,
          name: name || code,
          amount: amt,
          descriptions: it.description ? [it.description] : [],
        });
      }
    }

    debitsByAccount.forEach((entry) => {
      lines.push({
        account_code: entry.code,
        account_name: entry.name,
        debit:  entry.amount,
        credit: 0,
        description: `${params.supplier_name}${entry.descriptions.length > 0 ? ` (${entry.descriptions.slice(0, 2).join(", ")})` : ""}`,
      });
    });

    // Ajuste por redondeo si la suma difiere centavos de subtotalTotal
    const totalDebited = r2(lines.reduce((s, l) => s + l.debit, 0));
    const diff = r2(subtotalTotal - totalDebited);
    if (diff !== 0 && lines.length > 0) {
      lines[0].debit = r2(lines[0].debit + diff);
    }
  }

  // Fallback si no hay ítems detallados: debitar la cuenta seleccionada o la categoría
  if (lines.length === 0) {
    let code = params.account_code;
    let name = params.account_name;
    if (!code) {
      const expenseAccount = (params.category ? EXPENSE_CATEGORY_ACCOUNT[params.category] : undefined)
        ?? EXPENSE_CATEGORY_ACCOUNT["Otros"];
      code = expenseAccount.code;
      name = expenseAccount.name;
    }

    lines.push({
      account_code: code,
      account_name: name || "Gasto Operativo",
      debit:  subtotalTotal,
      credit: 0,
      description: params.supplier_name,
    });
  }

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

// ── Asiento por Pago de Gasto / Factura de Compra (Cruce con Bancos / Caja Chica) ─
/**
 * Pago o cruce del gasto:
 *   Dr. Cuentas por Pagar Proveedores (2.1.01.01)  (total)
 *   Cr.   Bancos / Caja Chica        (1.1.01.03 / 1.1.01.02)  (total)
 */
export async function createExpensePaymentJournalEntry(params: {
  expense_id:         string;
  payment_date:       string;
  supplier_name:      string;
  payment_method:     string;
  amount:             number;
  bank_account_name?: string | null;
  payment_reference?: string | null;
  user_id?:           string | null;
  user_email?:        string | null;
}) {
  let payAccount = { code: "1.1.01.03", name: "Bancos Cuentas Corrientes y Ahorros" };
  let creditDescription = `Salida de fondos (${params.payment_method}) — ${params.bank_account_name || params.payment_reference || params.supplier_name}`;
  let entryDescription = `Pago / Cruce Bancario — ${params.supplier_name} (${payAccount.name})`;

  if (params.payment_method === "efectivo") {
    payAccount = { code: "1.1.01.02", name: "Caja Chica" };
    entryDescription = `Pago / Cruce Caja Chica — ${params.supplier_name}`;
  } else if (params.payment_method === "prestamo_accionistas") {
    payAccount = { code: "2.1.05.01", name: "Préstamos Accionistas por Pagar" };
    creditDescription = `Préstamo Accionistas por Pagar — ${params.payment_reference || params.supplier_name}`;
    entryDescription = `Cruce Pasivo Préstamo Accionistas — ${params.supplier_name}`;
  }

  const lines: JournalLine[] = [
    {
      account_code: "2.1.01.01",
      account_name: "Cuentas por Pagar Proveedores",
      debit:  r2(params.amount),
      credit: 0,
      description: `Cancelación cta. por pagar — ${params.supplier_name}`,
    },
    {
      account_code: payAccount.code,
      account_name: payAccount.name,
      debit:  0,
      credit: r2(params.amount),
      description: creditDescription,
    },
  ];

  return insertJournalEntry({
    entry_date:     params.payment_date,
    description:    entryDescription,
    reference_type: "expense",
    reference_id:   params.expense_id,
    lines,
    user_id:        params.user_id,
    user_email:     params.user_email,
  });
}

// ── Mapeo: categoría de activo → cuentas contables ────────────────────────
const ASSET_ACCOUNTS: Record<string, { asset: string; assetName: string; dep: string; depName: string; depExp: string; depExpName: string }> = {
  // ⚠️ depExp apunta a cuentas de movimiento hijas de 5.2.08 (cuando existan) —
  //    por ahora 5.2.08 es el único grupo de Depreciaciones sin hijas creadas aún;
  //    se mantiene para no romper asientos existentes hasta que se creen las subcuentas.
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
