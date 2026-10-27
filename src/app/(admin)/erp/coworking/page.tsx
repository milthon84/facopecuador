import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import {
  Building2,
  Plus,
  Calendar,
  Clock,
  User,
  Stethoscope,
  GraduationCap,
  Presentation,
  FileCheck2,
  FileText,
  AlertCircle,
  Receipt,
  PlayCircle,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import {
  CoworkingRental,
  COWORKING_RESOURCES,
  COWORKING_STATUS_CONFIG,
  CoworkingResourceType,
  CoworkingRentalStatus,
} from "@/lib/coworking-types";

export const dynamic = "force-dynamic";

export default async function CoworkingListPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ month?: string; resource?: string; status?: string }>;
}) {
  await assertPermission("/erp/coworking");
  const canEdit = await hasWritePermission("/erp/coworking");
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();

  const now = new Date();
  const activeMonth = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const activeResource = searchParams.resource ?? "all";
  const activeStatus = searchParams.status ?? "all";

  const [year, month] = activeMonth.split("-").map(Number);
  const from = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const to = new Date(year, month, 0).toISOString().split("T")[0];

  // Meses disponibles para selector
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  let rentals: CoworkingRental[] = [];
  try {
    let query = supabase
      .from("coworking_rentals")
      .select("*")
      .gte("rental_date", from)
      .lte("rental_date", to)
      .order("rental_date", { ascending: false })
      .order("start_time", { ascending: true });

    if (activeResource !== "all") {
      query = query.eq("resource_type", activeResource);
    }
    if (activeStatus !== "all") {
      query = query.eq("status", activeStatus);
    }

    const { data, error } = await query;
    if (!error && data) {
      rentals = data as CoworkingRental[];
    }
  } catch (err) {
    console.warn("Error consultando coworking_rentals:", err);
  }

  // Métricas rápidas
  const totalReservas = rentals.length;
  const enCurso = rentals.filter((r) => r.status === "en_curso").length;
  const porFacturar = rentals.filter((r) => r.status === "finalizado").length;
  const totalFacturado = rentals
    .filter((r) => r.status === "facturado")
    .reduce((acc, r) => acc + Number(r.total_price || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900 tracking-tight">Alquiler y Coworking</h1>
            <p className="text-xs text-ink-500">
              Agenda de puestos clínicos, clínica completa y aulas con control de contratos y facturación
            </p>
          </div>
        </div>

        {canEdit && (
          <Link
            href="/erp/coworking/nuevo"
            className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition active:scale-[0.99]"
          >
            <Plus size={16} /> Agendar Reserva
          </Link>
        )}
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">Reservas del Mes</span>
          <span className="text-2xl font-black text-ink-950 font-mono mt-0.5 block">{totalReservas}</span>
        </div>
        <div className="bg-white border border-amber-100 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <PlayCircle size={11} /> En Curso Ahora
          </span>
          <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">{enCurso}</span>
        </div>
        <div className="bg-white border border-indigo-100 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <Receipt size={11} /> Por Facturar
          </span>
          <span className="text-2xl font-black text-indigo-900 font-mono mt-0.5 block">{porFacturar}</span>
        </div>
        <div className="bg-white border border-teal-100 rounded-2xl p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Facturado SRI</span>
          <span className="text-2xl font-black text-teal-800 font-mono mt-0.5 block">${totalFacturado.toFixed(2)}</span>
        </div>
      </div>

      {/* Selector de Mes */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <Calendar size={14} className="text-ink-400 shrink-0" />
        {months.map((m) => {
          const isSelected = m === activeMonth;
          const [y, mo] = m.split("-").map(Number);
          const label = new Date(y, mo - 1, 1).toLocaleDateString("es-EC", { month: "short", year: "numeric" });
          return (
            <Link
              key={m}
              href={`/erp/coworking?month=${m}&resource=${activeResource}&status=${activeStatus}`}
              className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 capitalize ${
                isSelected
                  ? "bg-lilac-600 text-white shadow-xs font-bold"
                  : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Filtros de Recurso */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white px-3 py-2 rounded-2xl border border-lilac-100 shadow-2xs text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink-700">
          <Filter size={13} className="text-lilac-600" />
          <span>Espacio:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Todos los espacios" },
            { id: "puesto_trabajo", label: "Puesto de Trabajo" },
            { id: "clinica_completa", label: "Clínica Completa" },
            { id: "aula_pequena", label: "Aula Pequeña" },
            { id: "aula_grande", label: "Aula Grande" },
          ].map((tab) => (
            <Link
              key={tab.id}
              href={`/erp/coworking?month=${activeMonth}&resource=${tab.id}&status=${activeStatus}`}
              className={`px-2.5 py-1 rounded-xl font-semibold transition ${
                activeResource === tab.id
                  ? "bg-lilac-600 text-white font-bold shadow-xs"
                  : "bg-lilac-50/60 text-ink-600 hover:bg-lilac-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Lista de Reservas */}
      {rentals.length === 0 ? (
        <div className="bg-white border border-lilac-100 rounded-2xl p-12 text-center space-y-3 shadow-sm">
          <Building2 size={36} className="text-lilac-200 mx-auto" />
          <h3 className="text-sm font-bold text-ink-800">No hay reservas registradas en este período</h3>
          <p className="text-xs text-ink-500 max-w-sm mx-auto">
            Puedes agendar el uso de puestos de trabajo dental, clínica o aulas para doctores y capacitaciones.
          </p>
          {canEdit && (
            <Link
              href="/erp/coworking/nuevo"
              className="inline-flex items-center gap-1.5 bg-lilac-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs hover:bg-lilac-700 transition"
            >
              <Plus size={14} /> Agendar la primera reserva
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {rentals.map((r) => {
            const resConfig = COWORKING_RESOURCES[r.resource_type] || COWORKING_RESOURCES.puesto_trabajo;
            const statusConfig = COWORKING_STATUS_CONFIG[r.status] || COWORKING_STATUS_CONFIG.reservado;

            const dateStr = new Date(r.rental_date + "T12:00:00").toLocaleDateString("es-EC", {
              weekday: "short",
              day: "numeric",
              month: "short",
            });

            return (
              <div
                key={r.id}
                className="bg-white border border-lilac-100 hover:border-lilac-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 group"
              >
                {/* Cabecera de la tarjeta: Recurso y Estado */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${resConfig.badgeColor}`}>
                        {r.resource_type === "puesto_trabajo" && <Stethoscope size={11} />}
                        {r.resource_type === "clinica_completa" && <Building2 size={11} />}
                        {r.resource_type === "aula_pequena" && <Presentation size={11} />}
                        {r.resource_type === "aula_grande" && <GraduationCap size={11} />}
                        {resConfig.name}
                      </span>
                      {r.resource_identifier && (
                        <span className="text-[10px] font-mono text-ink-500 bg-lilac-50 border border-lilac-200 px-1.5 py-0.2 rounded-md">
                          {r.resource_identifier}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-ink-900 truncate">
                      Dr(a). {r.doctor_name}
                    </h3>
                  </div>

                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusConfig.badgeCls}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Horario y Detalles */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-lilac-50/30 p-2.5 rounded-xl border border-lilac-100/60 font-medium">
                  <div className="flex items-center gap-1.5 text-ink-700">
                    <Calendar size={13} className="text-lilac-600 shrink-0" />
                    <span className="capitalize">{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-ink-700 font-mono">
                    <Clock size={13} className="text-lilac-600 shrink-0" />
                    <span>{r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)} ({r.hours}h)</span>
                  </div>
                  {r.doctor_document && (
                    <div className="col-span-2 text-[11px] text-ink-500 font-mono flex items-center justify-between">
                      <span>Doc: {r.doctor_document}</span>
                      {r.doctor_specialty && <span className="truncate max-w-[150px]">{r.doctor_specialty}</span>}
                    </div>
                  )}
                </div>

                {/* Documentos Requeridos (Contrato & Descargo) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-lilac-50 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${
                      r.contract_url
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      <FileCheck2 size={10} />
                      {r.contract_url ? "Contrato OK" : "Sin Contrato"}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${
                      r.waiver_url
                        ? "bg-teal-50 text-teal-800 border border-teal-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}>
                      <FileText size={10} />
                      {r.waiver_url ? "Descargo OK" : "Sin Descargo"}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-ink-900 text-sm">
                      ${Number(r.total_price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="pt-2 border-t border-lilac-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/erp/coworking/${r.id}`}
                    className="text-xs font-bold text-lilac-700 hover:text-lilac-900 hover:underline"
                  >
                    Ver Reserva / Check-in →
                  </Link>

                  {r.status === "facturado" ? (
                    <span className="text-[11px] font-mono font-bold text-teal-800 flex items-center gap-1">
                      <Receipt size={12} /> {r.invoice_number || "Factura SRI"}
                    </span>
                  ) : (
                    <Link
                      href={`/erp/facturacion/nueva?client_name=${encodeURIComponent(r.doctor_name)}&client_document=${encodeURIComponent(r.doctor_document || "")}&client_email=${encodeURIComponent(r.doctor_email || "")}&client_phone=${encodeURIComponent(r.doctor_phone || "")}&item_description=${encodeURIComponent(`Alquiler ${resConfig.name} - ${r.rental_date} (${r.start_time.slice(0, 5)} a ${r.end_time.slice(0, 5)})`)}&item_price=${r.total_price}&rental_id=${r.id}&return_url=${encodeURIComponent(`/erp/coworking/${r.id}`)}`}
                      className="inline-flex items-center gap-1 bg-lilac-50 hover:bg-lilac-100 text-lilac-800 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                    >
                      <Receipt size={12} /> Facturar
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
