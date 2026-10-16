"use client";

import { useState } from "react";
import { 
  Users, 
  Clock, 
  MapPin, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Settings, 
  Calendar, 
  ExternalLink, 
  Trash2, 
  RefreshCw, 
  UserCheck, 
  ShieldCheck, 
  Sliders, 
  Compass, 
  Eye, 
  X,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";
import AttendancePunchModal from "@/components/AttendancePunchModal";
import { 
  updateOfficeSettingsAction, 
  updateShiftAction, 
  deletePunchAction 
} from "./actions";
import type { AttendanceOfficeSettings, AttendanceShift, AttendancePunch } from "@/lib/attendance";
import { ecuadorTimeOf, ecuadorDateOf } from "@/lib/ecuador-time";

interface UserProfileDef {
  id: string;
  full_name: string;
  role: string;
  email?: string;
}

interface Props {
  initialTodayDate: string;
  initialOfficeSettings: AttendanceOfficeSettings;
  initialShift: AttendanceShift;
  initialPunches: AttendancePunch[];
  allProfiles: UserProfileDef[];
  canEdit: boolean;
  currentUserId: string;
}

export default function AttendanceAdminClient({
  initialTodayDate,
  initialOfficeSettings,
  initialShift,
  initialPunches,
  allProfiles,
  canEdit,
  currentUserId,
}: Props) {
  const [activeTab, setActiveTab] = useState<"today" | "history" | "settings" | "reports">("today");

  // Estados de datos
  const [punches, setPunches] = useState<AttendancePunch[]>(initialPunches);
  const [officeSettings, setOfficeSettings] = useState<AttendanceOfficeSettings>(initialOfficeSettings);
  const [shift, setShift] = useState<AttendanceShift>(initialShift);

  // Modal de Marcación
  const [punchModalOpen, setPunchModalOpen] = useState(false);
  const [punchType, setPunchType] = useState<"in" | "out">("in");

  // Lightbox Foto
  const [previewPhoto, setPreviewPhoto] = useState<AttendancePunch | null>(null);

  // Filtros Historial
  const [filterStartDate, setFilterStartDate] = useState(initialTodayDate.substring(0, 7) + "-01");
  const [filterEndDate, setFilterEndDate] = useState(initialTodayDate);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");

  // Estado formulario de configuración
  const [settingsForm, setSettingsForm] = useState({
    office_name: officeSettings.office_name,
    latitude: officeSettings.latitude,
    longitude: officeSettings.longitude,
    radius_meters: officeSettings.radius_meters,
    require_photo: officeSettings.require_photo,
    require_location: officeSettings.require_location,
    allow_out_of_bounds: officeSettings.allow_out_of_bounds,
  });

  const [shiftForm, setShiftForm] = useState({
    name: shift.name,
    start_time: shift.start_time,
    end_time: shift.end_time,
    grace_minutes: shift.grace_minutes,
  });

  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Mapear perfiles
  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  // Punch propio de hoy
  const myTodayPunches = punches.filter((p) => p.user_id === currentUserId && ecuadorDateOf(p.punched_at) === initialTodayDate);
  const myLastPunch = myTodayPunches.length > 0 ? myTodayPunches[myTodayPunches.length - 1] : null;
  const myIsCheckedIn = myLastPunch?.punch_type === "in";

  // Métricas del día de hoy
  const todayPunches = punches.filter((p) => ecuadorDateOf(p.punched_at) === initialTodayDate);
  const activeUserIdsToday = new Set(todayPunches.map((p) => p.user_id));
  const checkedInUsersToday = new Set(
    todayPunches.filter((p) => p.punch_type === "in").map((p) => p.user_id)
  );
  const latePunchesToday = todayPunches.filter((p) => p.punch_type === "in" && p.is_late);
  const outOfBoundsToday = todayPunches.filter((p) => !p.is_in_office);

  // Consolidado de Colaboradores Hoy
  const collaboratorsStatus = allProfiles.map((profile) => {
    const userPunches = todayPunches
      .filter((p) => p.user_id === profile.id)
      .sort((a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime());

    const inPunch = userPunches.find((p) => p.punch_type === "in");
    const outPunch = userPunches.find((p) => p.punch_type === "out");
    const lastP = userPunches.length > 0 ? userPunches[userPunches.length - 1] : null;

    let status: "working" | "finished" | "absent" = "absent";
    if (lastP?.punch_type === "in") status = "working";
    else if (inPunch && outPunch) status = "finished";

    return {
      profile,
      inPunch,
      outPunch,
      status,
    };
  });

  // Filtrado de historial
  const filteredHistory = punches.filter((p) => {
    const pDate = ecuadorDateOf(p.punched_at);
    if (filterStartDate && pDate < filterStartDate) return false;
    if (filterEndDate && pDate > filterEndDate) return false;
    if (filterUser !== "all" && p.user_id !== filterUser) return false;
    if (filterType !== "all" && p.punch_type !== filterType) return false;
    if (filterLocation === "office" && !p.is_in_office) return false;
    if (filterLocation === "out" && p.is_in_office) return false;
    return true;
  });

  // Capturar GPS del Admin para fijar coordenadas de la oficina
  function handleDetectCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización.");
      return;
    }
    setGpsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setSettingsForm((prev) => ({
          ...prev,
          latitude: Number(latitude.toFixed(7)),
          longitude: Number(longitude.toFixed(7)),
        }));
        setGpsDetecting(false);
        alert(`Ubicación GPS detectada con éxito (Precisión: ±${Math.round(accuracy)}m). Coordenadas actualizadas en el formulario.`);
      },
      (err) => {
        setGpsDetecting(false);
        alert("No se pudo obtener la ubicación: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Guardar configuración de oficina y turnos
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingSettings(true);
    setSaveMessage(null);

    try {
      const [resOffice, resShift] = await Promise.all([
        updateOfficeSettingsAction({
          office_name: settingsForm.office_name,
          latitude: Number(settingsForm.latitude),
          longitude: Number(settingsForm.longitude),
          radius_meters: Number(settingsForm.radius_meters),
          require_photo: settingsForm.require_photo,
          require_location: settingsForm.require_location,
          allow_out_of_bounds: settingsForm.allow_out_of_bounds,
        }),
        updateShiftAction({
          name: shiftForm.name,
          start_time: shiftForm.start_time,
          end_time: shiftForm.end_time,
          grace_minutes: Number(shiftForm.grace_minutes),
        }),
      ]);

      if (resOffice.success && resShift.success) {
        setOfficeSettings((prev) => ({
          ...prev,
          ...settingsForm,
        }));
        setShift((prev) => ({
          ...prev,
          ...shiftForm,
        }));
        setSaveMessage("Configuración actualizada correctamente.");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        alert(resOffice.error || resShift.error || "Error al guardar la configuración.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  // Eliminar marcación
  async function handleDeletePunch(id: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar este registro de asistencia? Esta acción quedará registrada en auditoría.")) {
      return;
    }
    try {
      const res = await deletePunchAction(id);
      if (res.success) {
        setPunches((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(res.error || "No se pudo eliminar el registro.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra Superior de Métricas y Acción Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-lilac-100 text-lilac-800 rounded-xl">
              <UserCheck size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900 leading-tight">Control de Asistencia</h2>
              <p className="text-xs text-ink-500">
                Monitoreo en vivo de presencia, puntualidad con selfie y geolocalización GPS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setPunchType(myIsCheckedIn ? "out" : "in");
              setPunchModalOpen(true);
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm flex items-center gap-2 transition active:scale-95 ${
              myIsCheckedIn
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Camera size={15} />
            <span>{myIsCheckedIn ? "Timbrar Mi Salida" : "Timbrar Mi Entrada"}</span>
          </button>

          <a
            href={`/api/admin/asistencia/export?from=${filterStartDate}&to=${filterEndDate}`}
            className="px-3.5 py-2.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-800 border border-lilac-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Download size={14} />
            <span>Exportar Excel</span>
          </a>
        </div>
      </div>

      {/* Tarjetas de Métricas de Hoy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900">{checkedInUsersToday.size}</span>
            <p className="text-xs text-ink-500 font-medium">Presentes Hoy</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-lilac-50 text-lilac-700 rounded-xl shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900">{allProfiles.length}</span>
            <p className="text-xs text-ink-500 font-medium">Total Personal</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900">{latePunchesToday.length}</span>
            <p className="text-xs text-ink-500 font-medium">Llegadas con Atraso</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <span className="text-2xl font-black text-ink-900">{outOfBoundsToday.length}</span>
            <p className="text-xs text-ink-500 font-medium">Marcaciones Fuera Sede</p>
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación del Módulo */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("today")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "today"
              ? "border-lilac-700 text-lilac-900"
              : "border-transparent text-ink-500 hover:text-ink-800"
          }`}
        >
          <Clock size={15} />
          <span>Hoy / En Vivo ({checkedInUsersToday.size})</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "history"
              ? "border-lilac-700 text-lilac-900"
              : "border-transparent text-ink-500 hover:text-ink-800"
          }`}
        >
          <Calendar size={15} />
          <span>Historial & Fotos</span>
        </button>

        {canEdit && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "settings"
                ? "border-lilac-700 text-lilac-900"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            <Settings size={15} />
            <span>Configuración de Sede</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("reports")}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === "reports"
              ? "border-lilac-700 text-lilac-900"
              : "border-transparent text-ink-500 hover:text-ink-800"
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Reporte Consolidado</span>
        </button>
      </div>

      {/* CONTENIDO TAB 1: HOY / EN VIVO */}
      {activeTab === "today" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-ink-900">Estado del Personal Hoy ({initialTodayDate})</h3>
            <span className="text-xs text-ink-400">Tolerancia de atraso: {shift.grace_minutes} min</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink-700">
              <thead className="bg-lilac-50/40 text-ink-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Entrada</th>
                  <th className="py-3 px-4">Salida</th>
                  <th className="py-3 px-4">Ubicación</th>
                  <th className="py-3 px-4 text-center">Selfie</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {collaboratorsStatus.map(({ profile, inPunch, outPunch, status }) => {
                  return (
                    <tr key={profile.id} className="hover:bg-lilac-50/20 transition">
                      {/* Colaborador */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-lilac-100 text-lilac-800 font-bold flex items-center justify-center shrink-0">
                            {profile.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-ink-900">{profile.full_name}</div>
                            <div className="text-[11px] text-ink-400 capitalize">{profile.role}</div>
                          </div>
                        </div>
                      </td>

                      {/* Entrada */}
                      <td className="py-3 px-4">
                        {inPunch ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-ink-900">
                              {ecuadorTimeOf(inPunch.punched_at)}
                            </span>
                            {inPunch.is_late ? (
                              <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                Atraso +{inPunch.late_minutes}m
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                A tiempo
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">--:--</span>
                        )}
                      </td>

                      {/* Salida */}
                      <td className="py-3 px-4">
                        {outPunch ? (
                          <div className="font-bold text-ink-900">
                            {ecuadorTimeOf(outPunch.punched_at)}
                          </div>
                        ) : (
                          <span className="text-gray-300">--:--</span>
                        )}
                      </td>

                      {/* Ubicación */}
                      <td className="py-3 px-4">
                        {inPunch ? (
                          <div className="flex items-center gap-1.5">
                            {inPunch.is_in_office ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                <CheckCircle2 size={13} />
                                <span>En oficina ({inPunch.distance_meters !== null ? `${inPunch.distance_meters}m` : "OK"})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                                <AlertTriangle size={13} />
                                <span>Fuera ({inPunch.distance_meters}m)</span>
                              </span>
                            )}
                            {inPunch.latitude && inPunch.longitude && (
                              <a
                                href={`https://www.google.com/maps?q=${inPunch.latitude},${inPunch.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-lilac-600 hover:text-lilac-800 p-0.5"
                                title="Ver en Google Maps"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">Sin registro</span>
                        )}
                      </td>

                      {/* Selfie */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {inPunch?.photo_url && (
                            <button
                              onClick={() => setPreviewPhoto(inPunch)}
                              className="relative group w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-2xs hover:scale-105 transition"
                              title="Ver foto de entrada"
                            >
                              <img src={inPunch.photo_url} alt="Entrada" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                <Eye size={12} />
                              </div>
                            </button>
                          )}
                          {outPunch?.photo_url && (
                            <button
                              onClick={() => setPreviewPhoto(outPunch)}
                              className="relative group w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-2xs hover:scale-105 transition"
                              title="Ver foto de salida"
                            >
                              <img src={outPunch.photo_url} alt="Salida" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                <Eye size={12} />
                              </div>
                            </button>
                          )}
                          {!inPunch?.photo_url && !outPunch?.photo_url && (
                            <span className="text-gray-300">--</span>
                          )}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 text-center">
                        {status === "working" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Laborando
                          </span>
                        )}
                        {status === "finished" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-lilac-50 text-lilac-700 border border-lilac-200 rounded-full font-bold text-[10px]">
                            ✓ Completado
                          </span>
                        )}
                        {status === "absent" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full font-medium text-[10px]">
                            Sin timbrar
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 2: HISTORIAL & FOTOS */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-400 uppercase">Desde</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-ink-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-400 uppercase">Hasta</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-ink-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-400 uppercase">Colaborador</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-ink-800"
              >
                <option value="all">Todos los colaboradores</option>
                {allProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-400 uppercase">Tipo</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-ink-800"
              >
                <option value="all">Entradas y Salidas</option>
                <option value="in">Solo Entradas</option>
                <option value="out">Solo Salidas</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-400 uppercase">Ubicación</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-ink-800"
              >
                <option value="all">Todas</option>
                <option value="office">En la Oficina</option>
                <option value="out">Fuera de la Oficina</option>
              </select>
            </div>
          </div>

          {/* Tabla de Historial */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-700">
                <thead className="bg-lilac-50/40 text-ink-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4 text-center">Selfie</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Puntualidad</th>
                    <th className="py-3 px-4">Ubicación</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-400 text-xs">
                        No se encontraron registros con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((punch) => {
                      const profile = profileMap.get(punch.user_id);
                      return (
                        <tr key={punch.id} className="hover:bg-lilac-50/20 transition">
                          {/* Foto Selfie */}
                          <td className="py-2.5 px-4 text-center">
                            {punch.photo_url ? (
                              <button
                                onClick={() => setPreviewPhoto(punch)}
                                className="relative group w-9 h-9 rounded-lg overflow-hidden border border-gray-200 shadow-2xs hover:scale-105 transition inline-block"
                              >
                                <img src={punch.photo_url} alt="Selfie" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                                  <Eye size={12} />
                                </div>
                              </button>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>

                          {/* Colaborador */}
                          <td className="py-2.5 px-4 font-bold text-ink-900">
                            {profile?.full_name || "Usuario"}
                            <div className="text-[10px] text-ink-400 font-normal capitalize">
                              {profile?.role || "Personal"}
                            </div>
                          </td>

                          {/* Fecha y Hora */}
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-ink-800">{ecuadorDateOf(punch.punched_at)}</span>{" "}
                            <span className="text-ink-500 font-mono">({ecuadorTimeOf(punch.punched_at)})</span>
                          </td>

                          {/* Tipo */}
                          <td className="py-2.5 px-4">
                            {punch.punch_type === "in" ? (
                              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                Entrada
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                Salida
                              </span>
                            )}
                          </td>

                          {/* Puntualidad */}
                          <td className="py-2.5 px-4">
                            {punch.punch_type === "in" ? (
                              punch.is_late ? (
                                <span className="text-amber-700 font-semibold text-xs">
                                  Atraso: {punch.late_minutes}m
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold text-xs">A tiempo</span>
                              )
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>

                          {/* Ubicación */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              {punch.is_in_office ? (
                                <span className="text-emerald-700 font-medium">
                                  En oficina ({punch.distance_meters !== null ? `${punch.distance_meters}m` : "OK"})
                                </span>
                              ) : (
                                <span className="text-rose-600 font-medium">
                                  Fuera ({punch.distance_meters}m)
                                </span>
                              )}
                              {punch.latitude && punch.longitude && (
                                <a
                                  href={`https://www.google.com/maps?q=${punch.latitude},${punch.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-lilac-600 hover:text-lilac-800 p-0.5"
                                  title="Abrir mapa"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-4 text-center">
                            {canEdit && (
                              <button
                                onClick={() => handleDeletePunch(punch.id)}
                                className="p-1 text-gray-400 hover:text-rose-600 transition"
                                title="Eliminar registro"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO TAB 3: CONFIGURACIÓN DE SEDE & TURNOS */}
      {activeTab === "settings" && canEdit && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
          {saveMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{saveMessage}</span>
            </div>
          )}

          {/* Bloque 1: Ubicación y Geocerca */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="text-lilac-700" size={18} />
                <h3 className="font-bold text-sm text-ink-900">Ubicación de la Clínica / Sede</h3>
              </div>
              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={gpsDetecting}
                className="px-3 py-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Compass size={14} className={gpsDetecting ? "animate-spin" : ""} />
                <span>{gpsDetecting ? "Detectando GPS..." : "Detectar mi ubicación actual"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Nombre de la Sede</label>
                <input
                  type="text"
                  value={settingsForm.office_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, office_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Radio Permitido (Metros)</label>
                <input
                  type="number"
                  min="20"
                  max="5000"
                  value={settingsForm.radius_meters}
                  onChange={(e) => setSettingsForm({ ...settingsForm, radius_meters: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
                <p className="text-[10px] text-ink-400 mt-1">Margen de tolerancia alrededor de la clínica (recomendado: 100m a 200m).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Latitud</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={settingsForm.latitude}
                  onChange={(e) => setSettingsForm({ ...settingsForm, latitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Longitud</label>
                <input
                  type="number"
                  step="0.0000001"
                  value={settingsForm.longitude}
                  onChange={(e) => setSettingsForm({ ...settingsForm, longitude: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>
            </div>

            {/* Opciones de Validación */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.require_photo}
                  onChange={(e) => setSettingsForm({ ...settingsForm, require_photo: e.target.checked })}
                  className="rounded text-lilac-600 focus:ring-lilac-500"
                />
                <span className="text-xs font-semibold text-ink-800">
                  Exigir fotografía selfie obligatoria para marcar
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.require_location}
                  onChange={(e) => setSettingsForm({ ...settingsForm, require_location: e.target.checked })}
                  className="rounded text-lilac-600 focus:ring-lilac-500"
                />
                <span className="text-xs font-semibold text-ink-800">
                  Exigir GPS y permisos de ubicación obligatorios para marcar
                </span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.allow_out_of_bounds}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allow_out_of_bounds: e.target.checked })}
                  className="rounded text-lilac-600 focus:ring-lilac-500"
                />
                <div>
                  <span className="text-xs font-semibold text-ink-800">
                    Permitir timbrar fuera de la oficina pero alertar en el sistema
                  </span>
                  <p className="text-[11px] text-ink-400">
                    Si se desmarca, la aplicación bloqueará la marcación si el empleado no está dentro del radio.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Bloque 2: Turno y Puntualidad */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Clock className="text-lilac-700" size={18} />
              <h3 className="font-bold text-sm text-ink-900">Horario de Trabajo y Tolerancia</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Hora de Entrada Esperada</label>
                <input
                  type="time"
                  step="1"
                  value={shiftForm.start_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Hora de Salida Esperada</label>
                <input
                  type="time"
                  step="1"
                  value={shiftForm.end_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Tolerancia de Atraso (Minutos)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={shiftForm.grace_minutes}
                  onChange={(e) => setShiftForm({ ...shiftForm, grace_minutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                  required
                />
                <p className="text-[10px] text-ink-400 mt-1">Minutos de gracia antes de marcar retraso.</p>
              </div>
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-2.5 bg-ink-900 hover:bg-ink-800 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {isSavingSettings ? "Guardando..." : "Guardar Configuración"}
            </button>
          </div>
        </form>
      )}

      {/* CONTENIDO TAB 4: REPORTE CONSOLIDADO */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-ink-900">Resumen Mensual por Colaborador</h3>
              <p className="text-xs text-ink-500">
                Consolidado de días asistidos, puntualidad y marcaciones para nómina.
              </p>
            </div>

            <a
              href={`/api/admin/asistencia/export?from=${filterStartDate}&to=${filterEndDate}`}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"
            >
              <FileSpreadsheet size={16} />
              <span>Descargar Reporte en Excel (.xlsx)</span>
            </a>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink-700">
                <thead className="bg-lilac-50/40 text-ink-500 uppercase tracking-wider font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Rol / Cargo</th>
                    <th className="py-3 px-4 text-center">Días Asistidos</th>
                    <th className="py-3 px-4 text-center">Entradas</th>
                    <th className="py-3 px-4 text-center">Salidas</th>
                    <th className="py-3 px-4 text-center">Atrasos</th>
                    <th className="py-3 px-4 text-center">Minutos Atraso</th>
                    <th className="py-3 px-4 text-center">Fuera de Sede</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allProfiles.map((p) => {
                    const userPunches = punches.filter((punch) => punch.user_id === p.id);
                    const daysSet = new Set(userPunches.map((punch) => ecuadorDateOf(punch.punched_at)));
                    const ins = userPunches.filter((punch) => punch.punch_type === "in");
                    const outs = userPunches.filter((punch) => punch.punch_type === "out");
                    const lates = ins.filter((punch) => punch.is_late);
                    const totalLateMin = lates.reduce((sum, item) => sum + (item.late_minutes || 0), 0);
                    const outBounds = userPunches.filter((punch) => !punch.is_in_office);

                    return (
                      <tr key={p.id} className="hover:bg-lilac-50/20 transition">
                        <td className="py-3 px-4 font-bold text-ink-900">{p.full_name}</td>
                        <td className="py-3 px-4 text-ink-500 capitalize">{p.role}</td>
                        <td className="py-3 px-4 text-center font-semibold text-ink-800">{daysSet.size}</td>
                        <td className="py-3 px-4 text-center font-semibold text-emerald-700">{ins.length}</td>
                        <td className="py-3 px-4 text-center font-semibold text-amber-700">{outs.length}</td>
                        <td className="py-3 px-4 text-center">
                          {lates.length > 0 ? (
                            <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                              {lates.length}
                            </span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {totalLateMin > 0 ? (
                            <span className="font-bold text-amber-800">{totalLateMin} m</span>
                          ) : (
                            <span className="text-gray-300">0 m</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {outBounds.length > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                              {outBounds.length}
                            </span>
                          ) : (
                            <span className="text-gray-300">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lightbox para Ampliar Foto Selfie */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            <div className="p-4 bg-ink-900 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">
                  Selfie de {previewPhoto.punch_type === "in" ? "Entrada" : "Salida"}
                </h4>
                <p className="text-xs text-white/70">
                  {profileMap.get(previewPhoto.user_id)?.full_name} • {ecuadorDateOf(previewPhoto.punched_at)} {ecuadorTimeOf(previewPhoto.punched_at)}
                </p>
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="w-full aspect-4/3 bg-black flex items-center justify-center">
              <img
                src={previewPhoto.photo_url}
                alt="Selfie ampliada"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4 bg-gray-50 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-ink-800">Ubicación: </span>
                {previewPhoto.is_in_office ? (
                  <span className="text-emerald-700 font-bold">En oficina ({previewPhoto.distance_meters} m)</span>
                ) : (
                  <span className="text-rose-600 font-bold">Fuera de oficina ({previewPhoto.distance_meters} m)</span>
                )}
              </div>

              {previewPhoto.latitude && previewPhoto.longitude && (
                <a
                  href={`https://www.google.com/maps?q=${previewPhoto.latitude},${previewPhoto.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white border border-gray-200 text-ink-800 rounded-lg font-bold flex items-center gap-1.5 hover:bg-gray-100 transition"
                >
                  <MapPin size={14} className="text-lilac-700" />
                  <span>Ver en Google Maps</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Marcación */}
      {punchModalOpen && (
        <AttendancePunchModal
          isOpen={punchModalOpen}
          onClose={() => setPunchModalOpen(false)}
          punchType={punchType}
          officeSettings={officeSettings}
          onSuccess={(newPunch) => {
            setPunches((prev) => [newPunch, ...prev]);
          }}
        />
      )}
    </div>
  );
}
