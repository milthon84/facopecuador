import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";
import GastoCajaChicaModal from "@/components/GastoCajaChicaModal";
import ReponerCajaChicaModal from "@/components/ReponerCajaChicaModal";
import SetupCajaChicaModal from "@/components/SetupCajaChicaModal";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string | null;
  account_type: string;
  initial_balance: number;
  is_active: boolean;
};

type BankTx = {
  id: string;
  account_id: string;
  type: "ingreso" | "egreso";
  amount: number;
  date: string;
  description: string;
  reference: string | null;
  status: string;
};

export default async function CajaChicaPage() {
  await assertPermission("/erp/caja-chica");
  const canEdit = await hasWritePermission("/erp/caja-chica");

  const supabase = createAdminClient();
  const [{ data: allAccounts }, { data: allTx }] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("is_active", true).order("bank_name"),
    supabase
      .from("bank_transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Caja Chica: solo cuentas tipo "caja" que NO son Caja General.
  const esCajaGeneral = (a: any) =>
    a.is_caja_general === true ||
    ["efectivo", "general"].some((k) => a.bank_name.toLowerCase().includes(k));

  const cajaAccounts = ((allAccounts as BankAccount[]) || []).filter(
    (a) => a.account_type === "caja" && !esCajaGeneral(a)
  );
  const bankAccounts = ((allAccounts as BankAccount[]) || []).filter(
    (a) => a.account_type !== "caja"
  );
  const cajaGeneral = ((allAccounts as BankAccount[]) || []).find(esCajaGeneral);

  const sourceAccounts = [
    ...(cajaGeneral
      ? [
          {
            id: cajaGeneral.id,
            bank_name: `Caja General — ${cajaGeneral.bank_name}`,
            account_number: null,
            account_type: "caja",
          },
        ]
      : []),
    ...bankAccounts,
  ];

  const txMap = new Map<string, BankTx[]>();
  ((allTx as BankTx[]) || []).forEach((tx) => {
    if (!txMap.has(tx.account_id)) txMap.set(tx.account_id, []);
    txMap.get(tx.account_id)!.push(tx);
  });

  function calcBalance(account: BankAccount): number {
    const txs = (txMap.get(account.id) || []).filter((t) => t.status === "confirmado");
    return r2(
      account.initial_balance +
        txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0) -
        txs.filter((t) => t.type === "egreso").reduce((s, t) => s + t.amount, 0)
    );
  }

  // ── Sin caja configurada ─────────────────────────────────────────────────
  if (cajaAccounts.length === 0) {
    return (
      <div className="max-w-md mx-auto py-10">
        <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2 mb-6">
          <Wallet className="text-lilac-600" /> Caja Chica
        </h1>
        {canEdit ? (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-ink-900">Configurar caja chica</h2>
              <p className="text-xs text-ink-500 mt-1">
                Crea una caja chica para gastos menores de oficina o atención.
              </p>
            </div>
            <SetupCajaChicaModal />
          </div>
        ) : (
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-6 text-center">
            <h2 className="font-semibold text-ink-900 mb-2">No hay Caja Chica configurada</h2>
            <p className="text-sm text-ink-500">
              Contacta al administrador para configurar el fondo inicial de la Caja Chica.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Vista principal ───────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {cajaAccounts.map((caja) => {
        const balance = calcBalance(caja);
        const txs = txMap.get(caja.id) || [];
        const isLow = balance < caja.initial_balance * 0.2;
        const deficit = r2(Math.max(caja.initial_balance - balance, 0));

        return (
          <div key={caja.id} className="space-y-4">
            {/* ── Balance + acciones ─────────────────────────────────────── */}
            <div
              className={`rounded-2xl p-5 border shadow-sm ${
                isLow ? "bg-red-50 border-red-200" : "bg-green-50 border-green-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    {caja.bank_name}
                  </p>
                  <p
                    className={`text-4xl font-bold mt-1 tabular-nums ${
                      isLow ? "text-red-700" : "text-green-800"
                    }`}
                  >
                    ${balance.toFixed(2)}
                  </p>
                  {isLow ? (
                    <p className="text-xs text-red-600 mt-1 font-semibold">
                      ⚠ Saldo bajo · Reponer ${deficit.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xs text-green-700 mt-1">
                      Fondo inicial: ${caja.initial_balance.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Botones de acción modal */}
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <GastoCajaChicaModal cajaId={caja.id} />
                    <ReponerCajaChicaModal
                      cajaId={caja.id}
                      deficit={deficit}
                      sourceAccounts={sourceAccounts}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Movimientos ───────────────────────────────────────────── */}
            <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-lilac-50 flex items-center justify-between">
                <h3 className="font-semibold text-ink-900 text-sm">Movimientos</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-400">{txs.length} registros</span>
                  <Link
                    href="/erp/bancos"
                    className="text-xs text-lilac-600 hover:underline flex items-center gap-1"
                  >
                    Ver cuenta <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
              {txs.length === 0 ? (
                <p className="text-center text-ink-400 text-sm py-10">Sin movimientos aún.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-lilac-50/50 text-xs text-ink-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Descripción</th>
                        <th className="px-4 py-2.5 text-left">Ref.</th>
                        <th className="px-4 py-2.5 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lilac-50">
                      {txs.map((tx) => (
                        <tr key={tx.id} className="hover:bg-lilac-50/20">
                          <td className="px-4 py-2.5 text-xs text-ink-500 whitespace-nowrap">
                            {new Date(tx.date + "T12:00:00").toLocaleDateString("es-EC")}
                          </td>
                          <td className="px-4 py-2.5 text-ink-800 text-sm">{tx.description}</td>
                          <td className="px-4 py-2.5 text-xs text-ink-400 font-mono">
                            {tx.reference ?? "—"}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                              tx.type === "ingreso" ? "text-green-700" : "text-red-600"
                            }`}
                          >
                            {tx.type === "ingreso" ? "+" : "−"}${tx.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
