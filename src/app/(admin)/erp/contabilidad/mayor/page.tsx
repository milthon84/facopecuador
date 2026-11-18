import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth-action";
import { formatAsientoCode, formatEgresoCode, formatIngresoCode } from "@/lib/accounting-codes";
import LibroMayorClient, { MayorAccount, AccountOption } from "./LibroMayorClient";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

function isAcreedora(code: string): boolean {
  return code.startsWith("2.") || code.startsWith("3.") || code.startsWith("4.");
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function formatDateDMY(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  return dateStr;
}

function getPreviousDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const prevD = String(dt.getDate()).padStart(2, "0");
  const prevM = String(dt.getMonth() + 1).padStart(2, "0");
  const prevY = dt.getFullYear();
  return `${prevD}/${prevM}/${prevY}`;
}

function extractReference(description: string, refType: string): string {
  if (!description) return "";
  // Check for [Ref: XYZ]
  const refMatch = description.match(/\[(?:Ref|Doc|Factura|Comprobante):\s*([^\]]+)\]/i);
  if (refMatch) return refMatch[1].trim();

  // Check for #1234 or 001-002-000001437
  const docMatch = description.match(/(?:#|n[°o]\.?\s*)?(\d{3}-\d{3}-\d{9}|\d{3}-\d{3}-\d{6,9}|\b\d{4,9}\b)/i);
  if (docMatch) return docMatch[1].trim();

  return "";
}

function determineModuleAndType(refType: string, description: string): { mod: string; tp: string } {
  const desc = (description || "").toLowerCase();
  
  if (refType === "invoice") {
    if (desc.includes("cobro") || desc.includes("recauda")) {
      return { mod: "ING", tp: "01" };
    }
    return { mod: "FAC", tp: "01" };
  }
  
  if (refType === "expense") {
    if (desc.includes("pago") || desc.includes("cruce") || desc.includes("banco") || desc.includes("caja")) {
      return { mod: "EGR", tp: "02" };
    }
    return { mod: "GAS", tp: "02" };
  }
  
  if (refType === "credit_note") {
    return { mod: "NC", tp: "04" };
  }
  
  if (refType === "manual") {
    return { mod: "MAN", tp: "AS" };
  }
  
  if (refType === "monthly_closure") {
    return { mod: "CIE", tp: "CR" };
  }

  if (desc.includes("cobro") || desc.includes("ingreso")) {
    return { mod: "ING", tp: "01" };
  }
  if (desc.includes("pago") || desc.includes("egreso")) {
    return { mod: "EGR", tp: "02" };
  }
  
  return { mod: "AS", tp: "01" };
}

export default async function LibroMayorPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    cuenta?: string;
    cuentaDesde?: string;
    cuentaHasta?: string;
    tipo?: string;
    doc?: string;
    soloConMovimientos?: string;
    generar?: string;
  }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultDesde = `${currentYear}-${currentMonth}-01`;
  const defaultHasta = new Date(currentYear, now.getMonth() + 1, 0).toISOString().split("T")[0];

  const desde = searchParams.desde || defaultDesde;
  const hasta = searchParams.hasta || defaultHasta;
  const selectedCuenta = searchParams.cuenta || "";
  const cuentaDesde = searchParams.cuentaDesde || "";
  const cuentaHasta = searchParams.cuentaHasta || "";
  const tipoFiltro = searchParams.tipo || "todos";
  const docFiltro = (searchParams.doc || "").trim().toLowerCase();
  const soloConMovimientos = searchParams.soloConMovimientos !== "false";
  const isGenerated = searchParams.generar === "1";

  const supabase = createAdminClient();

  // 1. Cargar Plan de Cuentas completo (activas)
  const { data: rawAccounts } = await supabase
    .from("accounts")
    .select("code, name, type, parent_code, is_movement")
    .eq("active", true)
    .order("code");

  const allAccountsList = rawAccounts || [];
  const movementAccountsList = allAccountsList.filter((a) => a.is_movement);

  const accountOptions: AccountOption[] = movementAccountsList.map((a) => ({
    code: a.code,
    name: a.name,
    type: a.type,
  }));

  // 2. Obtener datos de la empresa / SRI
  const { data: sriConfig } = await supabase
    .from("sri_configs")
    .select("razon_social, nombre_comercial, ruc")
    .limit(1)
    .maybeSingle();

  const companyName =
    sriConfig?.razon_social || sriConfig?.nombre_comercial || "FACOP - ODONTOLOGÍA INTEGRAL";
  const companyRuc = sriConfig?.ruc || "";

  let mayorAccounts: MayorAccount[] = [];
  let totalGeneralDebe = 0;
  let totalGeneralHaber = 0;

  // 3. Si se solicita generar el informe:
  if (isGenerated) {
    // Filtrar cuentas según criterios
    let targetAccounts = movementAccountsList;
    if (selectedCuenta) {
      targetAccounts = targetAccounts.filter((a) => a.code === selectedCuenta);
    } else if (cuentaDesde && cuentaHasta) {
      targetAccounts = targetAccounts.filter(
        (a) => a.code >= cuentaDesde && a.code <= cuentaHasta
      );
    } else if (cuentaDesde) {
      targetAccounts = targetAccounts.filter((a) => a.code >= cuentaDesde);
    } else if (cuentaHasta) {
      targetAccounts = targetAccounts.filter((a) => a.code <= cuentaHasta);
    }

    const targetAccountCodes = new Set(targetAccounts.map((a) => a.code));

    // A. Consultar saldos anteriores (asientos posted con entry_date < desde)
    const { data: prevLinesData } = await supabase
      .from("journal_lines")
      .select("account_code, debit, credit, journal_entries!inner(entry_date, status)")
      .lt("journal_entries.entry_date", desde)
      .eq("journal_entries.status", "posted");

    const prevBalanceMap = new Map<string, { debit: number; credit: number }>();
    for (const pl of prevLinesData || []) {
      const code = pl.account_code;
      if (targetAccountCodes.has(code)) {
        const cur = prevBalanceMap.get(code) || { debit: 0, credit: 0 };
        cur.debit += Number(pl.debit || 0);
        cur.credit += Number(pl.credit || 0);
        prevBalanceMap.set(code, cur);
      }
    }

    // B. Consultar movimientos del período (desde <= entry_date <= hasta)
    const { data: periodEntriesData } = await supabase
      .from("journal_entries")
      .select(`
        id,
        entry_number,
        entry_code,
        entry_date,
        description,
        reference_type,
        reference_id,
        status,
        created_at,
        lines:journal_lines(
          id,
          account_code,
          account_name,
          debit,
          credit,
          description
        )
      `)
      .gte("entry_date", desde)
      .lte("entry_date", hasta)
      .eq("status", "posted")
      .order("entry_date", { ascending: true })
      .order("entry_number", { ascending: true })
      .order("id", { ascending: true });

    // Filtrar entradas por tipo y documento si aplica
    const filteredEntries = (periodEntriesData || []).filter((entry) => {
      const descLower = (entry.description || "").toLowerCase();
      const refType = entry.reference_type;

      // Filtro Tipo
      if (tipoFiltro !== "todos") {
        if (tipoFiltro === "manual" && refType !== "manual") return false;
        if (tipoFiltro === "invoice" && refType !== "invoice") return false;
        if (tipoFiltro === "expense" && refType !== "expense") return false;
        if (tipoFiltro === "credit_note" && refType !== "credit_note") return false;
        if (tipoFiltro === "cierre" && refType !== "monthly_closure") return false;
        if (tipoFiltro === "pago" && !descLower.includes("pago") && !descLower.includes("cruce") && !descLower.includes("egreso")) return false;
        if (tipoFiltro === "cobro" && !descLower.includes("cobro") && !descLower.includes("recauda") && !descLower.includes("ingreso")) return false;
      }

      // Filtro Documento / Referencia
      if (docFiltro) {
        const matchesDesc = descLower.includes(docFiltro);
        const matchesCode = (entry.entry_code || "").toLowerCase().includes(docFiltro);
        const matchesLines = (entry.lines || []).some(
          (l: any) =>
            (l.description || "").toLowerCase().includes(docFiltro) ||
            (l.account_name || "").toLowerCase().includes(docFiltro)
        );
        if (!matchesDesc && !matchesCode && !matchesLines) return false;
      }

      return true;
    });

    // Mapear líneas de movimientos asociándolas a su cuenta contable
    const accountMovementsMap = new Map<string, any[]>();
    let runningEntryNum = 1;

    for (const entry of filteredEntries) {
      const entryNum = entry.entry_number ? Number(entry.entry_number) : runningEntryNum++;
      const { mod, tp } = determineModuleAndType(entry.reference_type, entry.description);
      const reference = extractReference(entry.description, entry.reference_type);

      let entryCode = entry.entry_code;
      if (!entryCode) {
        if (mod === "ING") {
          entryCode = formatIngresoCode(entryNum, entry.entry_date);
        } else if (mod === "EGR") {
          entryCode = formatEgresoCode(entryNum, entry.entry_date);
        } else if (mod === "NC") {
          entryCode = formatAsientoCode(entryNum, entry.entry_date, "nc");
        } else {
          entryCode = formatAsientoCode(entryNum, entry.entry_date, "diario");
        }
      }

      for (const line of entry.lines || []) {
        const accCode = line.account_code;
        if (!targetAccountCodes.has(accCode)) continue;

        if (!accountMovementsMap.has(accCode)) {
          accountMovementsMap.set(accCode, []);
        }

        const debit = r2(Number(line.debit || 0));
        const credit = r2(Number(line.credit || 0));

        if (debit === 0 && credit === 0) continue;

        // Concepto: preferencia por glosa de línea si existe, sino la glosa general
        let concepto = line.description || entry.description || "Movimiento contable";
        concepto = concepto.replace(/\[(?:Ref|Doc|Factura|Comprobante):[^\]]+\]/gi, "").trim();

        accountMovementsMap.get(accCode)!.push({
          id: line.id || `${entry.id}_${accCode}`,
          rawDate: entry.entry_date,
          date: formatDateDMY(entry.entry_date),
          mod,
          tp,
          asiento: entryCode,
          referencia: reference || (entry.reference_type === "invoice" ? "FAC" : ""),
          concepto,
          debe: debit,
          haber: credit,
        });
      }
    }

    const initialDateStr = getPreviousDateStr(desde);
    const finalDateStr = formatDateDMY(hasta);

    // C. Armar el Libro Mayor para cada cuenta
    for (const acc of targetAccounts) {
      const isCredit = isAcreedora(acc.code);
      const nature: "deudora" | "acreedora" = isCredit ? "acreedora" : "deudora";

      // Saldo Inicial
      const prev = prevBalanceMap.get(acc.code) || { debit: 0, credit: 0 };
      const initialBalance = isCredit
        ? r2(prev.credit - prev.debit)
        : r2(prev.debit - prev.credit);

      const movements = accountMovementsMap.get(acc.code) || [];

      // Si se deben ocultar cuentas sin saldo y sin movimientos:
      if (soloConMovimientos && initialBalance === 0 && movements.length === 0) {
        continue;
      }

      // Calcular saldos acumulados línea a línea y agrupar por mes
      let runningBalance = initialBalance;
      let accTotalDebe = 0;
      let accTotalHaber = 0;

      // Agrupación mensual
      const monthlyBuckets = new Map<string, any[]>();
      for (const m of movements) {
        const debit = m.debe;
        const credit = m.haber;
        accTotalDebe = r2(accTotalDebe + debit);
        accTotalHaber = r2(accTotalHaber + credit);

        if (isCredit) {
          runningBalance = r2(runningBalance + credit - debit);
        } else {
          runningBalance = r2(runningBalance + debit - credit);
        }
        m.saldo = runningBalance;

        // Bucket mensual: "YYYY-MM"
        const monthKey = m.rawDate.substring(0, 7);
        if (!monthlyBuckets.has(monthKey)) {
          monthlyBuckets.set(monthKey, []);
        }
        monthlyBuckets.get(monthKey)!.push(m);
      }

      const months: MayorAccount["months"] = [];
      const sortedMonthKeys = Array.from(monthlyBuckets.keys()).sort();

      for (const mKey of sortedMonthKeys) {
        const monthMovements = monthlyBuckets.get(mKey)!;
        const [mYear, mMonthNum] = mKey.split("-").map(Number);
        const monthName = MONTH_NAMES[mMonthNum - 1] || `Mes ${mMonthNum}`;

        const mDebe = r2(monthMovements.reduce((s, row) => s + row.debe, 0));
        const mHaber = r2(monthMovements.reduce((s, row) => s + row.haber, 0));
        const mSaldoFinal = monthMovements[monthMovements.length - 1].saldo;

        months.push({
          monthKey: mKey,
          monthName: `${monthName} ${mYear}`,
          movements: monthMovements,
          totalDebe: mDebe,
          totalHaber: mHaber,
          saldoFinalMes: mSaldoFinal,
        });
      }

      totalGeneralDebe = r2(totalGeneralDebe + accTotalDebe);
      totalGeneralHaber = r2(totalGeneralHaber + accTotalHaber);

      mayorAccounts.push({
        code: acc.code,
        name: acc.name,
        nature,
        initialBalance,
        initialBalanceDate: initialDateStr,
        months,
        totalDebe: accTotalDebe,
        totalHaber: accTotalHaber,
        finalBalance: runningBalance,
        finalDate: finalDateStr,
      });
    }
  }

  return (
    <LibroMayorClient
      initialDesde={desde}
      initialHasta={hasta}
      initialCuenta={selectedCuenta}
      initialCuentaDesde={cuentaDesde}
      initialCuentaHasta={cuentaHasta}
      initialTipo={tipoFiltro}
      initialDoc={docFiltro}
      initialSoloConMovimientos={soloConMovimientos}
      isGenerated={isGenerated}
      accountOptions={accountOptions}
      allAccounts={allAccountsList}
      mayorAccounts={mayorAccounts}
      totalGeneralDebe={totalGeneralDebe}
      totalGeneralHaber={totalGeneralHaber}
      companyName={companyName}
      companyRuc={companyRuc}
    />
  );
}
