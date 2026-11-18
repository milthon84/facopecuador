import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth-action";
import BalanceGeneralClient, { AccountItem } from "./BalanceGeneralClient";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

type JournalLine = { account_code: string; account_name: string; debit: number; credit: number };

function groupByCode(
  lines: JournalLine[],
  accountNames: Map<string, string>
): Map<string, AccountItem> {
  const map = new Map<string, AccountItem>();
  for (const l of lines) {
    const code = l.account_code;
    const officialName = accountNames.get(code) || l.account_name || code;
    const prev = map.get(code);
    if (prev) {
      prev.balance += l.debit - l.credit;
    } else {
      map.set(code, {
        code,
        name: officialName,
        balance: l.debit - l.credit,
      });
    }
  }
  return map;
}

function getSection(map: Map<string, AccountItem>, prefix: string, invert = false): AccountItem[] {
  return Array.from(map.values())
    .filter((a) => a.code.startsWith(prefix))
    .map((a) => ({ ...a, balance: invert ? r2(-a.balance) : r2(a.balance) }))
    .filter((a) => a.balance !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export default async function BalanceGeneralPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const now = new Date();
  const toDate =
    searchParams.to ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const supabase = createAdminClient();

  const [
    { data: rawLines },
    { data: sriConfig },
    { data: allAccounts },
  ] = await Promise.all([
    supabase
      .from("journal_lines")
      .select("account_code, account_name, debit, credit, journal_entries!inner(entry_date, status)")
      .lte("journal_entries.entry_date", toDate)
      .eq("journal_entries.status", "posted"),
    supabase
      .from("sri_configs")
      .select("razon_social, nombre_comercial, ruc")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("accounts")
      .select("code, name")
      .eq("active", true),
  ]);

  const companyName =
    sriConfig?.razon_social || sriConfig?.nombre_comercial || "FACOP - ODONTOLOGÍA INTEGRAL";
  const companyRuc = sriConfig?.ruc || "";

  const accountNames = new Map<string, string>();
  for (const acc of allAccounts || []) {
    accountNames.set(acc.code, acc.name);
  }

  const lines: JournalLine[] = (rawLines || []).map((l: any) => ({
    account_code: l.account_code,
    account_name: l.account_name,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
  }));

  const byCode = groupByCode(lines, accountNames);

  // 1. Activos (Naturaleza Deudora: debit - credit)
  const activos = getSection(byCode, "1");
  const activosCorrientes = activos.filter((a) => a.code.startsWith("1.1"));
  const activosNoCorrientes = activos.filter((a) => !a.code.startsWith("1.1"));

  // 2. Pasivos (Naturaleza Acreedora: credit - debit)
  const pasivos = getSection(byCode, "2", true);
  const pasivosCorrientes = pasivos.filter((a) => a.code.startsWith("2.1"));
  const pasivosNoCorrientes = pasivos.filter((a) => !a.code.startsWith("2.1"));

  // 3. Patrimonio (Naturaleza Acreedora: credit - debit)
  const patrimonio = getSection(byCode, "3", true);

  // 4. Resultados del ejercicio (Ingresos 4.* - Gastos 5.* / Costos 6.*)
  const ingresos = getSection(byCode, "4", true);
  const gastos = [...getSection(byCode, "5"), ...getSection(byCode, "6")];
  const ingresosTotal = r2(ingresos.reduce((s, a) => s + a.balance, 0));
  const gastosTotal = r2(gastos.reduce((s, a) => s + a.balance, 0));
  const utilidadNeta = r2(ingresosTotal - gastosTotal);

  // Totales de situación financiera
  const totalActivos = r2(activos.reduce((s, a) => s + a.balance, 0));
  const totalPasivos = r2(pasivos.reduce((s, a) => s + a.balance, 0));
  const totalPatrimonio = r2(patrimonio.reduce((s, a) => s + a.balance, 0));
  const totalPasivosPatrimonio = r2(totalPasivos + totalPatrimonio + utilidadNeta);

  const cuadre = r2(totalActivos - totalPasivosPatrimonio);

  return (
    <BalanceGeneralClient
      toDate={toDate}
      companyName={companyName}
      companyRuc={companyRuc}
      activosCorrientes={activosCorrientes}
      activosNoCorrientes={activosNoCorrientes}
      pasivosCorrientes={pasivosCorrientes}
      pasivosNoCorrientes={pasivosNoCorrientes}
      patrimonio={patrimonio}
      ingresosTotal={ingresosTotal}
      gastosTotal={gastosTotal}
      utilidadNeta={utilidadNeta}
      totalActivos={totalActivos}
      totalPasivos={totalPasivos}
      totalPatrimonio={totalPatrimonio}
      totalPasivosPatrimonio={totalPasivosPatrimonio}
      cuadre={cuadre}
    />
  );
}
