import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateDocumento } from "@/lib/validators";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { assertWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

async function saveDividend(formData: FormData) {
  "use server";
  await assertWritePermission("/erp/contabilidad");
  const supabase   = createAdminClient();
  const authClient = createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const utility_amount = Number(formData.get("utility_amount") || 0);
  const percentage     = Number(formData.get("percentage")     || 0);
  // Retención: 10% para persona natural residente, 5% para reinversión, etc.
  // Se ingresa manualmente para flexibilidad
  const tax_withheld   = Number(formData.get("tax_withheld")   || 0);
  const net_amount     = Math.round((utility_amount - tax_withheld) * 100) / 100;
  const year           = Number(formData.get("fiscal_year"));

  await supabase.from("dividends").insert({
    fiscal_year:       year,
    resolution_date:   formData.get("resolution_date") as string,
    resolution_number: (formData.get("resolution_number") as string)?.trim() || null,
    beneficiary_name:  (formData.get("beneficiary_name") as string).trim(),
    beneficiary_ruc:   (() => {
      const ruc = (formData.get("beneficiary_ruc") as string).trim();
      const err = validateDocumento(ruc);
      if (err) throw new Error(`RUC/Cédula inválido: ${err}`);
      return ruc;
      })(),
    beneficiary_type:  formData.get("beneficiary_type") as string,
    percentage,
    utility_amount,
    tax_withheld,
    net_amount,
    notes:             (formData.get("notes") as string)?.trim() || null,
    created_by_id:     user?.id ?? null,
  });

  redirect(`/erp/contabilidad/dividendos?year=${year}`);
}

export default async function NuevoDividendoPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await assertWritePermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;
  const year = searchParams.year ?? String(new Date().getFullYear());
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/erp/contabilidad/dividendos?year=${year}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Registrar Dividendo</h1>
          <p className="text-xs text-ink-500">Año fiscal {year}</p>
        </div>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-6">
        <form action={saveDividend} className="space-y-4">
          <input type="hidden" name="fiscal_year" value={year} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Fecha del Acta *</label>
              <input type="date" name="resolution_date" required defaultValue={today}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">N° de Acta</label>
              <input type="text" name="resolution_number" placeholder="Acta-001-2025"
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Nombre Beneficiario *</label>
              <input type="text" name="beneficiary_name" required placeholder="Nombre completo"
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">RUC / Cédula *</label>
              <input type="text" name="beneficiary_ruc" required placeholder="1793235116001"
                pattern="\d{10}|\d{13}" title="Ingrese cédula (10 dígitos) o RUC (13 dígitos)"
                maxLength={13}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Tipo de Beneficiario *</label>
              <select name="beneficiary_type" required
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white">
                <option value="natural">Persona Natural Residente</option>
                <option value="juridica">Persona Jurídica Nacional</option>
                <option value="exterior">Residente en el Exterior</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">% Participación</label>
              <input type="number" name="percentage" min="0" max="100" step="0.01" defaultValue="0"
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
            </div>
          </div>

          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 space-y-3">
            <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Montos</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Utilidad Asignada *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                  <input type="number" name="utility_amount" required min="0" step="0.01" defaultValue="0"
                    className="w-full border border-lilac-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Retención (IR Dividendos)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                  <input type="number" name="tax_withheld" min="0" step="0.01" defaultValue="0"
                    className="w-full border border-lilac-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
                </div>
                <p className="text-[11px] text-ink-400">Pers. natural residente: 10% · Exterior: 25%</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink-700">Notas</label>
            <textarea name="notes" rows={2} placeholder="Observaciones..."
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white resize-none" />
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit"
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-lilac-200">
              <Save size={16} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
