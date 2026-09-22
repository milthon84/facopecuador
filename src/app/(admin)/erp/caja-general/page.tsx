import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { Banknote, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import TransferirCajaGeneralModal from "@/components/TransferirCajaGeneralModal";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

type Tx = {
  id: string;
  type: "ingreso" | "egreso";
  amount: number;
  date: string;
  description: string;
  reference: string | null;
  status: string;
  invoice_id: string | null;
  invoices: { invoice_number: string } | null;
};

export default async function CajaGeneralPage() {
  await assertPermission("/erp/caja-general");
  const canEdit = await hasWritePermission("/erp/caja-general");

  const supabase = createAdminClient();

  // Buscar la Caja General
  const { data: allCajas } = await supabase
    .from("bank_accounts")
    .select("*")
    .eq("account_type", "caja")
    .eq("is_active", true);

  const esCajaGeneral = (a: any) =>
    a.is_caja_general === true ||
    ["efectivo", "general"].some(k => (a.bank_name as string).toLowerCase().includes(k));

  const cajaGeneral = (allCajas || []).find(esCajaGeneral);
  const otrasCajas  = (allCajas || []).filter(a => a.id !== cajaGeneral?.id);

  // Otras cuentas bancarias para transferir
  const { data: bancos } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_number, account_type")
    .eq("is_active", true)
    .neq("account_type", "caja")
    .order("bank_name");

  // Movimientos de la Caja General
  let transactions: Tx[] = [];
  if (cajaGeneral) {
    const { data: txs } = await supabase
      .from("bank_transactions")
      .select("id, type, amount, date, description, reference, status, invoice_id, invoices(invoice_number)")
      .eq("account_id", cajaGeneral.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    transactions = (txs as unknown as Tx[]) || [];
  }

  // Calcular saldo
  const confirmed    = transactions.filter(t => t.status === "confirmado");
  const totalIngreso = confirmed.filter(t => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
  const totalEgreso  = confirmed.filter(t => t.type === "egreso").reduce((s, t) => s + t.amount, 0);
  const balance      = cajaGeneral ? r2(cajaGeneral.initial_balance + totalIngreso - totalEgreso) : 0;

  // Destinos disponibles para transferir
  const destinos = [
    ...(bancos || []).map(b => ({
      id: b.id,
      label: `${b.bank_name}${b.account_number ? ` · ${b.account_number}` : ""}`,
      type: "banco",
    })),
    ...otrasCajas.map(c => ({
      id: c.id,
      label: `Caja Chica — ${c.bank_name}`,
      type: "caja_chica",
    })),
  ];

  if (!cajaGeneral) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <Banknote size={40} className="text-lilac-300 mx-auto mb-4" />
        <p className="text-ink-500 font-medium">No hay Caja General configurada</p>
        <p className="text-sm text-ink-400 mt-1">
          Ve a <Link href="/erp/bancos" className="text-lilac-600 underline">Bancos</Link> y marca
          una cuenta tipo "Caja" como Caja General.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header + saldo */}
      <div className={`rounded-2xl p-5 border shadow-sm ${balance > 0 ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Banknote size={18} className="text-green-600" />
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wide">Caja General / Efectivo</p>
            </div>
            <p className={`text-4xl font-bold tabular-nums ${balance > 0 ? "text-green-800" : "text-ink-500"}`}>
              ${balance.toFixed(2)}
            </p>
            <p className="text-xs text-ink-400 mt-1">Recibe automáticamente cobros en efectivo</p>
          </div>

          {/* Botón transferir con Modal */}
          {canEdit && (
            <TransferirCajaGeneralModal
              cajaId={cajaGeneral.id}
              maxBalance={balance}
              destinos={destinos}
            />
          )}
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
          <TrendingUp size={16} className="text-green-600 shrink-0" />
          <div>
            <p className="text-[11px] text-green-700">Ingresos totales</p>
            <p className="font-bold text-green-800">${r2(totalIngreso).toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3">
          <TrendingDown size={16} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[11px] text-red-600">Transferido/retirado</p>
            <p className="font-bold text-red-600">${r2(totalEgreso).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-lilac-50 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900 text-sm">Movimientos</h3>
          <span className="text-xs text-ink-400">{transactions.length} registros</span>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center text-ink-400 text-sm py-10">
            Sin movimientos — los cobros en efectivo aparecerán aquí automáticamente.
          </p>
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
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-lilac-50/20">
                    <td className="px-4 py-2.5 text-xs text-ink-500 whitespace-nowrap">
                      {new Date(tx.date + "T12:00:00").toLocaleDateString("es-EC")}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-ink-800 leading-tight">{tx.description}</p>
                      {tx.invoices && (
                        <Link href={`/erp/facturacion/${tx.invoice_id}`}
                          className="text-[11px] text-lilac-600 hover:underline">
                          Factura {tx.invoices.invoice_number}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink-400 font-mono">{tx.reference ?? "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${tx.type === "ingreso" ? "text-green-700" : "text-red-600"}`}>
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
}
