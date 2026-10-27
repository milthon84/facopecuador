import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission } from "@/lib/roles";
import CoworkingDetailClient from "./CoworkingDetailClient";
import { CoworkingRental } from "@/lib/coworking-types";

export const dynamic = "force-dynamic";

export default async function CoworkingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authData = await getCachedUserAndPermissions();
  const { user, role, allowedPaths } = authData;

  if (!user) {
    redirect("/erp/login");
  }

  const hasAccess =
    role === "admin" ||
    role === "recepcionista" ||
    hasPermission(role, "/erp/coworking", allowedPaths);

  if (!hasAccess) {
    redirect("/erp/coworking?denied=1");
  }

  const canEdit =
    role === "admin" ||
    role === "recepcionista" ||
    hasPermission(role, "/erp/coworking/modificar", allowedPaths) ||
    hasPermission(role, "/erp/modificar", allowedPaths);

  const { id } = await params;
  if (!id) notFound();

  const supabase = createAdminClient();

  const { data: rawRental, error } = await supabase
    .from("coworking_rentals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !rawRental) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-lilac-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-lilac-100 text-lilac-600 flex items-center justify-center mx-auto">
          <ArrowLeft size={20} />
        </div>
        <h2 className="text-lg font-bold text-ink-900">Reserva de Coworking no encontrada</h2>
        <p className="text-sm text-ink-600">
          La reserva solicitada no existe o fue eliminada previamente del sistema.
        </p>
        <div>
          <Link
            href="/erp/coworking"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-lilac-600 text-white font-bold text-sm hover:bg-lilac-700 transition"
          >
            ← Volver a la Agenda de Coworking
          </Link>
        </div>
      </div>
    );
  }
  const rental = rawRental as CoworkingRental;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/erp/coworking?date=${rental.rental_date}`}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-xs"
          title="Volver a la Agenda de Coworking"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 tracking-tight">Detalle de Reserva de Coworking</h1>
          <p className="text-xs text-ink-500 font-mono">ID: {rental.id.slice(0, 8)} · Check-in, documentación y facturación</p>
        </div>
      </div>

      <CoworkingDetailClient
        rental={rental}
        canEdit={canEdit}
      />
    </div>
  );
}
