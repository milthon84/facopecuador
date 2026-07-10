import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Plus, DollarSign, CheckCircle2, Clock, XCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertPermission, assertWritePermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function markPaid(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/contabilidad");
  const id = formData.get("id") as string;
  const paid_date = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();
  await supabase.from("dividends").update({ status: "paid", paid_date }).eq("id", id);
  revalidatePath("/erp/contabilidad/dividendos");
}

async function voidDividend(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/contabilidad");
  const id = formData.get("id") as string;
  const supabase = createAdminClient();
  await supabase.from("dividends").update({ status: "void" }).eq("id", id);
  revalidatePath("/erp/contabilidad/dividendos");
}

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700", icon: <Clock size={11} /> },
  paid:    { label: "Pagado",    cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
  void:    { label: "Anulado",   cls: "bg-red-100 text-red-700",     icon: <XCircle size={11} /> },
};

export default async function DividendosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  await assertPermission("/erp/contabilidad");
  const canEdit = await hasWritePermission("/erp/contabilidad");

  const currentYear = new Date().getFullYear();
  const year = Number(searchParams.year ?? currentYear);

  const supabase = createAdminClient();
  const { data: dividends } = await supabase
    .from("dividends")
    .select("*")
    .eq("fiscal_year", year)
    .neq("status", "void")
    .order("resolution_date");

  const items = dividends ?? [];
  const totalUtilidad = items.reduce((s, d) => s + Number(d.utility_amount), 0);
  const totalRetencion = items.reduce((s, d) => s + Number(d.tax_withheld), 0);
  const totalNeto = items.reduce((s, d) => s + Number(d.net_amount), 0);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/erp/contabilidad" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink-900">ADI — Dividendos y Utilidades</h1>
          <p className="text-xs text-ink-500">Anexo de Dividendos para declaración anual SRI</p>
        </div>
        {canEdit && (
          <Link href={`/erp/contabilidad/dividendos/nuevo?year=${year}`}
            className="flex items-center gap-1.5 text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-xl font-medium shadow-sm">
            <Plus size={15} /> Registrar
          </Link>
        )}
      </div>

      {/* Selector año */}
      <div className="flex gap-2 mb-5">
        {years.map(y => (
          <Link key={y} href={`/erp/contabilidad/dividendos?year=${y}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              y === year ? "bg-lilac-600 text-white" : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
            }`}>
            {y}
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">Utilidad Distribuida</div>
          <div className="text-lg font-bold text-ink-900">${totalUtilidad.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">Retención Aplicada</div>
          <div className="text-lg font-bold text-red-600">${totalRetencion.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl px-3 py-2.5 border border-lilac-100 shadow-sm">
          <div className="text-[11px] text-ink-500 mb-1">Neto Pagado</div>
          <div className="text-lg font-bold text-green-700">${totalNeto.toFixed(2)}</div>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-14 text-center">
            <DollarSign size={32} className="text-lilac-200 mx-auto mb-2" />
            <p className="text-sm text-ink-400">No hay dividendos registrados para {year}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-lilac-50/50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Beneficiario</th>
                <th className="px-4 py-2.5 text-left">RUC/CI</th>
                <th className="px-4 py-2.5 text-center">%</th>
                <th className="px-4 py-2.5 text-right">Utilidad</th>
                <th className="px-4 py-2.5 text-right">Retención</th>
                <th className="px-4 py-2.5 text-right">Neto</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
                <th className="px-4 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {items.map(d => {
                const s = STATUS_MAP[d.status] ?? STATUS_MAP.pending;
                return (
                  <tr key={d.id} className="hover:bg-lilac-50/20">
                    <td className="px-4 py-2.5 font-medium text-ink-900">{d.beneficiary_name}</td>
                    <td className="px-4 py-2.5 font-mono text-ink-500 text-xs">{d.beneficiary_ruc}</td>
                    <td className="px-4 py-2.5 text-center text-ink-600">{d.percentage}%</td>
                    <td className="px-4 py-2.5 text-right">${Number(d.utility_amount).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">${Number(d.tax_withheld).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-green-700">${Number(d.net_amount).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
                        {s.icon}{s.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {canEdit && d.status === "pending" && (
                        <div className="flex gap-1">
                          <form action={markPaid}>
                            <input type="hidden" name="id" value={d.id} />
                            <button type="submit" className="text-[11px] text-green-700 hover:underline">Pagar</button>
                          </form>
                          <span className="text-ink-300">·</span>
                          <form action={voidDividend}>
                            <input type="hidden" name="id" value={d.id} />
                            <button type="submit" className="text-[11px] text-red-500 hover:underline">Anular</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
