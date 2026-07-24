import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Search } from "lucide-react";
import { assertPermission } from "@/lib/auth-action";

import QuickQuotationButton from "@/components/QuickQuotationButton";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string }

export default async function PacientesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await assertPermission("/erp/pacientes");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();
  const q = searchParams.q?.trim() || "";

  let query = supabase
    .from("patients")
    .select("id, full_name, document_number, phone, email, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,document_number.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: patients } = await query;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Pacientes</h1>

      <form className="card p-3 mb-4 flex items-center gap-2">
        <Search size={16} className="text-ink-600 ml-2" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, cédula, email o teléfono…"
          className="flex-1 outline-none text-sm bg-transparent"
        />
        <button className="btn-primary text-xs px-3 py-1.5">Buscar</button>
      </form>

      <div className="card overflow-hidden">
        {!patients || patients.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-600">No hay pacientes.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-lilac-50 text-xs uppercase text-lilac-700">
              <tr>
                <th className="text-left px-4 py-2">Nombre</th>
                <th className="text-left px-4 py-2 hidden sm:table-cell">Cédula</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Teléfono</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Email</th>
                <th className="text-right px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-lilac-50">
                  <td className="px-4 py-3">
                    <Link href={`/erp/pacientes/${p.id}`} className="font-medium hover:text-lilac-700">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ink-600">{p.document_number || "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-600">{p.phone}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-600">{p.email}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <QuickQuotationButton
                        patientId={p.id}
                        patientName={p.full_name}
                        patientPhone={p.phone}
                        patientEmail={p.email}
                      />
                      <Link
                        href={`/erp/pacientes/${p.id}`}
                        className="inline-flex items-center justify-center bg-lilac-700 hover:bg-lilac-800 text-white font-bold text-xs px-2.5 py-1 rounded-xl transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
                      >
                        Ver Ficha e Historial
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
