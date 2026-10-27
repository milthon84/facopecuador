import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Plus,
  Clock,
  User,
  Stethoscope,
  GraduationCap,
  Presentation,
  Receipt,
  PlayCircle,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  ShieldAlert,
} from "lucide-react";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";
import { hasPermission, getFirstAllowedPath } from "@/lib/roles";
import {
  CoworkingRental,
  COWORKING_RESOURCES,
  COWORKING_STATUS_CONFIG,
  CoworkingResourceType,
} from "@/lib/coworking-types";
import QuickCoworkingActions from "./QuickCoworkingActions";
import CoworkingDatePicker from "./CoworkingDatePicker";

export const dynamic = "force-dynamic";

// Ecuador timezone (UTC-5)
const EC_TZ = "America/Guayaquil";

function todayInEcuador(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: EC_TZ });
}

export default async function CoworkingAgendaPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{
    date?: string;
    view?: "day" | "month";
    month?: string;
    resource?: string;
    status?: string;
  }>;
}) {
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
    const firstAllowed = getFirstAllowedPath(role, allowedPaths);
    if (firstAllowed && firstAllowed !== "/erp/coworking") {
      redirect(firstAllowed);
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-xl font-bold text-ink-900 mb-2">Acceso Denegado</h1>
        <p className="text-sm text-ink-600 max-w-md">
          No tienes permisos asignados para acceder al módulo de Alquiler y Coworking. Por favor, solicita a un administrador que configure los permisos de tu rol.
        </p>
      </div>
    );
  }

  const canEdit =
    role === "admin" ||
    hasPermission(role, "/erp/coworking/modificar", allowedPaths) ||
    hasPermission(role, "/erp/modificar", allowedPaths);

  const searchParams = (await searchParamsPromise) || {};
  const supabase = createAdminClient();

  const todayEc = todayInEcuador();
  const activeView = searchParams.view === "month" ? "month" : "day";

  // Fecha seleccionada para la vista diaria
  const targetEcDate =
    typeof searchParams.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : todayEc;

  const isTargetToday = targetEcDate === todayEc;

  // Fechas navegación diaria (anterior y siguiente)
  const [ty, tm, td] = targetEcDate.split("-").map(Number);
  const prevDateObj = new Date(Date.UTC(ty, tm - 1, td - 1));
  const nextDateObj = new Date(Date.UTC(ty, tm - 1, td + 1));
  const prevDateStr = prevDateObj.toISOString().slice(0, 10);
  const nextDateStr = nextDateObj.toISOString().slice(0, 10);

  const displayDateTitle = isTargetToday
    ? "Hoy"
    : new Date(targetEcDate + "T12:00:00-05:00").toLocaleDateString("es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });

  // Filtros
  const activeResource = typeof searchParams.resource === "string" ? searchParams.resource : "all";
  const activeStatus = typeof searchParams.status === "string" ? searchParams.status : "all";

  // Rango mensual para la vista mensual alternativa
  const now = new Date();
  const activeMonth =
    typeof searchParams.month === "string" && /^\d{4}-\d{2}$/.test(searchParams.month)
      ? searchParams.month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [mYear, mMonth] = activeMonth.split("-").map(Number);
  const monthFrom = new Date(mYear, mMonth - 1, 1).toISOString().split("T")[0];
  const monthTo = new Date(mYear, mMonth, 0).toISOString().split("T")[0];

  let rentals: CoworkingRental[] = [];
  try {
    let query = supabase.from("coworking_rentals").select("*");

    if (activeView === "month") {
      query = query
        .gte("rental_date", monthFrom)
        .lte("rental_date", monthTo)
        .order("rental_date", { ascending: false })
        .order("start_time", { ascending: true });
    } else {
      query = query
        .eq("rental_date", targetEcDate)
        .order("start_time", { ascending: true });
    }

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

  // KPIs operativos (horas y estado)
  const totalCount = rentals.length;
  const enCursoCount = rentals.filter((r) => r.status === "en_curso").length;
  const pendientesFacturarCount = rentals.filter(
    (r) => r.status === "finalizado" || (r.status === "reservado" && !r.invoice_id)
  ).length;
  const facturadasCount = rentals.filter((r) => r.status === "facturado").length;
  const totalHoras = rentals.reduce((acc, r) => acc + Number(r.hours || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* ── Encabezado y Navegación de Fecha ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-lilac-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-ink-900 tracking-tight capitalize">
                {activeView === "day" ? displayDateTitle : "Historial de Alquiler"}
              </h1>

              {activeView === "day" && (
                <div className="flex items-center bg-white border border-lilac-200 rounded-xl overflow-hidden shadow-2xs">
                  <Link
                    href={`/erp/coworking?date=${prevDateStr}&resource=${activeResource}&status=${activeStatus}`}
                    className="p-1.5 hover:bg-lilac-50 text-ink-600 transition"
                    title="Día anterior"
                  >
                    <ChevronLeft size={16} />
                  </Link>
                  {!isTargetToday && (
                    <Link
                      href={`/erp/coworking?date=${todayEc}&resource=${activeResource}&status=${activeStatus}`}
                      className="px-2.5 py-1 text-xs font-semibold text-lilac-700 hover:bg-lilac-50 border-x border-lilac-100 transition"
                    >
                      Hoy
                    </Link>
                  )}
                  <Link
                    href={`/erp/coworking?date=${nextDateStr}&resource=${activeResource}&status=${activeStatus}`}
                    className="p-1.5 hover:bg-lilac-50 text-ink-600 transition"
                    title="Día siguiente"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              )}
            </div>

            <p className="text-xs text-ink-500 mt-0.5">
              {activeView === "day"
                ? `Agenda de puestos clínicos y aulas para el ${new Date(targetEcDate + "T12:00:00-05:00").toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })}`
                : "Registro mensual de reservas y facturación de espacios"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Alternar Vista Día / Mes */}
          <div className="flex items-center bg-white border border-lilac-200 rounded-xl p-0.5 shadow-2xs text-xs font-semibold">
            <Link
              href={`/erp/coworking?date=${targetEcDate}&resource=${activeResource}&view=day`}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeView === "day"
                  ? "bg-lilac-600 text-white font-bold shadow-2xs"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Agenda Diaria
            </Link>
            <Link
              href={`/erp/coworking?month=${activeMonth}&resource=${activeResource}&view=month`}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeView === "month"
                  ? "bg-lilac-600 text-white font-bold shadow-2xs"
                  : "text-ink-600 hover:text-ink-900"
              }`}
            >
              Ver Mes
            </Link>
          </div>

          {canEdit && (
            <Link
              href={`/erp/coworking/nuevo?date=${targetEcDate}`}
              className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl shadow-xs transition active:scale-[0.99]"
            >
              <Plus size={16} /> Agendar Reserva
            </Link>
          )}
        </div>
      </div>

      {/* ── KPIs Rápidos Operativos (Horas y Reservas) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white border border-lilac-100 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider block">
            {activeView === "day" ? "Reservas del Día" : "Reservas del Mes"}
          </span>
          <span className="text-2xl font-black text-ink-950 font-mono mt-0.5 block">
            {totalCount}
          </span>
        </div>
        <div className="bg-white border border-amber-100 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <PlayCircle size={11} /> En Atención Ahora
          </span>
          <span className="text-2xl font-black text-amber-900 font-mono mt-0.5 block">
            {enCursoCount}
          </span>
        </div>
        <div className="bg-white border border-indigo-100 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <Receipt size={11} /> Pendiente Facturar
          </span>
          <span className="text-2xl font-black text-indigo-900 font-mono mt-0.5 block">
            {pendientesFacturarCount}
          </span>
        </div>
        <div className="bg-white border border-teal-100 rounded-2xl p-3 shadow-2xs">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
            <Clock size={11} /> Horas de Uso {activeView === "day" ? "Hoy" : "Mes"}
          </span>
          <span className="text-2xl font-black text-teal-800 font-mono mt-0.5 block">
            {totalHoras} hrs
          </span>
        </div>
      </div>

      {/* ── Filtros Rápidos de Recursos ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white px-3.5 py-2.5 rounded-2xl border border-lilac-100 shadow-2xs text-xs">
        <div className="flex items-center gap-1.5 font-bold text-ink-700">
          <Filter size={13} className="text-lilac-600" />
          <span>Filtrar Espacio:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "Todos los espacios" },
            { id: "puesto_trabajo", label: "Puesto Dental (Sillón)" },
            { id: "clinica_completa", label: "Clínica Completa" },
            { id: "aula_pequena", label: "Aula Pequeña" },
            { id: "aula_grande", label: "Aula Grande" },
          ].map((tab) => (
            <Link
              key={tab.id}
              href={`/erp/coworking?date=${targetEcDate}&month=${activeMonth}&resource=${tab.id}&status=${activeStatus}&view=${activeView}`}
              className={`px-2.5 py-1 rounded-xl font-semibold transition ${
                activeResource === tab.id
                  ? "bg-lilac-600 text-white font-bold shadow-2xs"
                  : "bg-lilac-50/70 text-ink-600 hover:bg-lilac-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Lista Estilo Agenda de Reservas ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-lilac-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-base text-ink-900">
              {activeView === "day"
                ? isTargetToday
                  ? "Reservas de Alquiler y Coworking para Hoy"
                  : `Reservas para el ${new Date(targetEcDate + "T12:00:00-05:00").toLocaleDateString("es-EC", { day: "numeric", month: "long" })}`
                : `Reservas de ${new Date(mYear, mMonth - 1, 1).toLocaleDateString("es-EC", { month: "long", year: "numeric" })}`}
            </h2>
            <p className="text-xs text-ink-500">
              {rentals.length} {rentals.length === 1 ? "reserva agendada" : "reservas agendadas"}
            </p>
          </div>

          {activeView === "day" && (
            <CoworkingDatePicker
              targetDate={targetEcDate}
              resource={activeResource}
              status={activeStatus}
            />
          )}
        </div>

        {rentals.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Building2 size={36} className="text-lilac-200 mx-auto" />
            <h3 className="text-sm font-bold text-ink-800">
              {activeView === "day"
                ? isTargetToday
                  ? "No hay reservas agendadas para hoy."
                  : "No hay reservas para esta fecha."
                : "No hay reservas en este mes."}
            </h3>
            <p className="text-xs text-ink-500 max-w-sm mx-auto">
              Puedes agendar rápidamente con el nombre del doctor, horario y registrar un anticipo inicial si aplica.
            </p>
            {canEdit && (
              <Link
                href={`/erp/coworking/nuevo?date=${targetEcDate}`}
                className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition"
              >
                <Plus size={14} /> Agendar Reserva Ahora
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-lilac-50">
            {rentals.map((r) => {
              const resConfig =
                COWORKING_RESOURCES[r.resource_type] || COWORKING_RESOURCES.puesto_trabajo;
              const statusConfig =
                COWORKING_STATUS_CONFIG[r.status] || COWORKING_STATUS_CONFIG.reservado;

              const deposit = Number(r.deposit_amount || 0);
              const total = Number(r.total_price || 0);
              const balance = Math.max(0, Math.round((total - deposit) * 100) / 100);

              const formattedDate = new Date(r.rental_date + "T12:00:00").toLocaleDateString(
                "es-EC",
                {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }
              );

              const sTime = (r.start_time || "00:00").slice(0, 5);
              const eTime = (r.end_time || "00:00").slice(0, 5);

              // URL para facturar directamente
              const invoiceUrl = `/erp/facturacion/nueva?client_name=${encodeURIComponent(
                r.doctor_name || ""
              )}&client_document=${encodeURIComponent(
                r.doctor_document || ""
              )}&client_email=${encodeURIComponent(
                r.doctor_email || ""
              )}&client_phone=${encodeURIComponent(
                r.doctor_phone || ""
              )}&item_description=${encodeURIComponent(
                `Alquiler ${resConfig.name} - ${r.rental_date} (${sTime} a ${eTime})${
                  deposit > 0 ? ` [Anticipo previo: $${deposit.toFixed(2)}]` : ""
                }`
              )}&item_price=${balance > 0 ? balance : total}&rental_id=${r.id}&return_url=${encodeURIComponent(
                `/erp/coworking?date=${targetEcDate}`
              )}`;

              return (
                <li
                  key={r.id}
                  className="px-5 py-3.5 hover:bg-lilac-50/50 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                >
                  {/* Columna Horario & Fecha */}
                  <div className="w-full md:w-36 shrink-0 flex md:flex-col items-center md:items-start justify-between md:justify-center">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-ink-950 font-mono">
                      <Clock size={13} className="text-lilac-600 shrink-0" />
                      <span>
                        {sTime} - {eTime}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-500 font-medium">
                      {activeView === "month" && (
                        <span className="capitalize font-semibold text-ink-700 mr-1.5">
                          {formattedDate} ·
                        </span>
                      )}
                      <span>{r.hours}h ({resConfig.shortName})</span>
                    </div>
                  </div>

                  {/* Columna Doctor & Espacio */}
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/erp/coworking/${r.id}`}
                        className="font-bold text-sm text-ink-900 hover:text-lilac-700 hover:underline transition"
                      >
                        Dr(a). {r.doctor_name}
                      </Link>

                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${resConfig.badgeColor}`}
                      >
                        {r.resource_type === "puesto_trabajo" && <Stethoscope size={11} />}
                        {r.resource_type === "clinica_completa" && <Building2 size={11} />}
                        {r.resource_type === "aula_pequena" && <Presentation size={11} />}
                        {r.resource_type === "aula_grande" && <GraduationCap size={11} />}
                        <span>{resConfig.shortName}</span>
                      </span>

                      {r.resource_identifier && (
                        <span className="text-[10px] font-mono text-ink-500 bg-lilac-50 border border-lilac-200 px-1.5 py-0.2 rounded-md">
                          {r.resource_identifier}
                        </span>
                      )}
                    </div>

                    {/* Subtítulo: Contacto & Anticipo */}
                    <div className="flex items-center gap-2.5 mt-1 text-xs text-ink-600 flex-wrap">
                      {r.doctor_phone && <span>📞 {r.doctor_phone}</span>}
                      {r.doctor_document && (
                        <span className="font-mono text-ink-500">ID: {r.doctor_document}</span>
                      )}

                      <span className="text-[11px] font-semibold text-ink-700 bg-lilac-50/80 px-2 py-0.5 rounded-md border border-lilac-200">
                        ⏱️ {r.hours} {r.hours === 1 ? "hora" : "horas"} reservadas
                      </span>

                      {deposit > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check size={11} className="text-emerald-600" />
                          <span>Con anticipo ({r.deposit_payment_method || "Registrado"})</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones Rápidas (Iniciar/Finalizar) */}
                  <div className="shrink-0 flex items-center gap-2">
                    <QuickCoworkingActions
                      rentalId={r.id}
                      currentStatus={r.status}
                      canEdit={canEdit}
                    />
                  </div>

                  {/* Badges de Estado y Facturación Directa */}
                  <div className="shrink-0 flex items-center md:flex-col md:items-end gap-1.5 ml-auto md:ml-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeCls}`}
                    >
                      {statusConfig.label}
                    </span>

                    {/* Facturación similar a citas */}
                    {r.status === "facturado" ? (
                      r.invoice_id ? (
                        <Link
                          href={`/erp/facturacion/${r.invoice_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition shadow-2xs whitespace-nowrap"
                          title="Ver factura electrónica SRI"
                        >
                          <CheckCircle2 size={12} className="text-teal-600" />
                          <span>{r.invoice_number ? `Facturado — № ${r.invoice_number}` : "Facturado SRI"}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border border-teal-200 bg-teal-50 text-teal-800 shadow-2xs whitespace-nowrap">
                          <CheckCircle2 size={12} className="text-teal-600" />
                          <span>{r.invoice_number || "Facturado SRI"}</span>
                        </span>
                      )
                    ) : (
                      canEdit && (
                        <Link
                          href={invoiceUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition shadow-2xs whitespace-nowrap active:scale-95"
                          title="Generar factura electrónica SRI para este alquiler"
                        >
                          <Receipt size={12} className="text-amber-600" />
                          <span>Facturar Alquiler</span>
                        </Link>
                      )
                    )}

                    <Link
                      href={`/erp/coworking/${r.id}`}
                      className="text-[11px] font-semibold text-lilac-700 hover:text-lilac-900 hover:underline"
                    >
                      Ficha / Contrato →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
