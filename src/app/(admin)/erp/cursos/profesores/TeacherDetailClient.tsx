"use client";

import { useState, useRef } from "react";
import { 
  Award, GraduationCap, Calendar, FileText, Pencil, ArrowLeft, Mail, Phone, 
  UserCheck, ExternalLink, Download, CheckCircle2, X, Stethoscope, Search,
  Clock, AlertCircle, DollarSign, Filter, CheckCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { proxyStorageUrl } from "@/lib/storage-proxy";

interface AssignedAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "attended" | "no_show" | "cancelled" | string;
  reason?: string | null;
  patient?: any;
  dental_consultation?: any;
  invoice?: {
    id: string;
    invoice_number: string;
    total: number;
    sri_status: string;
  } | null;
}

interface Props {
  teacher: any;
  assignedCourses: any[];
  assignedClasses: any[];
  assignedAppointments?: AssignedAppointment[];
  billedTotal?: number;
  canEdit: boolean;
  editMode: boolean;
  updateTeacherAction: (formData: FormData) => Promise<void>;
}

const formatDateES = (d: string) => {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatDateTimeES = (isoStr: string) => {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export default function TeacherDetailClient({
  teacher,
  assignedCourses = [],
  assignedClasses = [],
  assignedAppointments = [],
  billedTotal = 0,
  canEdit,
  editMode,
  updateTeacherAction,
}: Props) {
  const isDoctor = teacher.is_doctor ?? true;
  const isTeacher = teacher.is_teacher ?? true;

  // Determinar pestaña inicial según roles
  const defaultTab = isDoctor && !isTeacher ? "atenciones" : "cursos";
  const [activeTab, setActiveTab] = useState<"atenciones" | "cursos" | "clases" | "cv">(defaultTab);
  
  // Filtros en pestaña de atenciones
  const [apptStatusFilter, setApptStatusFilter] = useState<string>("all");
  const [apptSearch, setApptSearch] = useState<string>("");

  // Modal de edición
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(editMode);
  const [editIsDoctor, setEditIsDoctor] = useState(isDoctor);
  const [editIsTeacher, setEditIsTeacher] = useState(isTeacher);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalClassesCount = assignedClasses.length;
  const attendedAppointments = assignedAppointments.filter((a) => a.status === "attended");

  // Filtrado de citas
  const filteredAppointments = assignedAppointments.filter((appt) => {
    if (apptStatusFilter !== "all" && appt.status !== apptStatusFilter) {
      return false;
    }
    if (apptSearch.trim()) {
      const q = apptSearch.toLowerCase();
      const p = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
      const pName = p?.full_name?.toLowerCase() || "";
      const pPhone = p?.phone?.toLowerCase() || "";
      const pDoc = p?.document_number?.toLowerCase() || "";
      const reason = appt.reason?.toLowerCase() || "";
      return pName.includes(q) || pPhone.includes(q) || pDoc.includes(q) || reason.includes(q);
    }
    return true;
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewPhotoUrl(URL.createObjectURL(file));
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editIsDoctor && !editIsTeacher) {
      setModalError("Debes seleccionar al menos un rol (Atención a Pacientes o Profesor / Cursos).");
      return;
    }
    setLoading(true);
    setModalError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await updateTeacherAction(formData);
      setIsEditingModalOpen(false);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setModalError(err?.message || "Error al actualizar especialista.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* Botón Volver */}
      <Link 
        href="/erp/cursos/profesores" 
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-lilac-100 shadow-2xs w-fit"
      >
        <ArrowLeft size={14} />
        <span>Volver al Directorio de Especialistas</span>
      </Link>

      {/* Ficha Principal del Especialista & Tarjetas KPI */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda: Ficha de Especialista */}
        <div className="md:col-span-1">
          <div className="card p-5 bg-white border border-lilac-100 shadow-sm rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Ficha de Especialista</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditIsDoctor(teacher.is_doctor ?? true);
                    setEditIsTeacher(teacher.is_teacher ?? true);
                    setModalError(null);
                    setIsEditingModalOpen(true);
                  }}
                  className="text-xs text-lilac-700 hover:text-lilac-800 font-bold flex items-center gap-1 cursor-pointer bg-lilac-50 border border-lilac-200 px-2.5 py-1 rounded-xl transition"
                >
                  <Pencil size={12} />
                  <span>Editar Perfil</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-3">
              {/* Foto con lápiz overlay interactivo */}
              <div
                onClick={() => {
                  if (canEdit) {
                    setEditIsDoctor(teacher.is_doctor ?? true);
                    setEditIsTeacher(teacher.is_teacher ?? true);
                    setModalError(null);
                    setIsEditingModalOpen(true);
                  }
                }}
                className={`relative group shrink-0 ${canEdit ? "cursor-pointer" : ""}`}
                title={canEdit ? "Haz clic para cambiar foto de perfil" : ""}
              >
                {teacher.photo_url ? (
                  <img
                    src={proxyStorageUrl(teacher.photo_url)}
                    alt={teacher.full_name}
                    loading="lazy"
                    className="w-16 h-16 rounded-2xl object-cover border border-lilac-200 shadow-2xs transition group-hover:brightness-95"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0 transition group-hover:bg-lilac-100">
                    <UserCheck size={28} />
                  </div>
                )}

                {canEdit && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white border border-lilac-200 text-ink-700 shadow-xs flex items-center justify-center group-hover:bg-lilac-600 group-hover:text-white group-hover:border-lilac-600 transition-all">
                    <Pencil size={11} />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 min-w-0 flex-1">
                <h1 className="text-base font-bold text-ink-950 leading-snug">{teacher.full_name}</h1>
                {teacher.specialty && (
                  <div className="text-xs text-ink-600 font-medium">
                    {teacher.specialty}
                  </div>
                )}

                {/* Badges de Roles */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {isDoctor && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                      <Stethoscope size={11} /> Atención a Pacientes
                    </span>
                  )}
                  {isTeacher && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-lilac-800 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-md">
                      <GraduationCap size={11} /> Profesor / Cursos
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-lilac-50 space-y-2 text-xs text-ink-700">
              {teacher.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-400 font-medium">Teléfono:</span>
                  <span className="font-semibold text-ink-900">{teacher.phone}</span>
                </div>
              )}
              {teacher.email && (
                <div className="flex justify-between items-center">
                  <span className="text-ink-400 font-medium">Correo:</span>
                  <span className="font-semibold text-lilac-900 underline">{teacher.email}</span>
                </div>
              )}
            </div>

            {teacher.cv_url && (
              <div className="pt-3 border-t border-lilac-50">
                <a
                  href={proxyStorageUrl(teacher.cv_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-lilac-50 hover:bg-lilac-100 text-lilac-700 text-xs px-3.5 py-2 rounded-xl transition font-bold border border-lilac-200 shadow-2xs"
                >
                  <FileText size={14} className="text-lilac-600" />
                  <span>Ver / Descargar Hoja de Vida (CV)</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: KPI Cards según Roles */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {isDoctor && (
              <>
                <div className="card p-3.5 bg-teal-50/40 border border-teal-100 rounded-2xl flex items-center gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-white border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                    <Stethoscope size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium">Atenciones</div>
                    <div className="text-lg font-bold text-teal-950 leading-tight">
                      {attendedAppointments.length} <span className="text-xs text-ink-400 font-normal">/ {assignedAppointments.length}</span>
                    </div>
                  </div>
                </div>

                <div className="card p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-2xl flex items-center gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium">Facturado</div>
                    <div className="text-base font-bold text-emerald-950 leading-tight">
                      {formatCurrency(billedTotal)}
                    </div>
                  </div>
                </div>
              </>
            )}

            {isTeacher && (
              <>
                <div className="card p-3.5 bg-lilac-50/50 border border-lilac-100 rounded-2xl flex items-center gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-white border border-lilac-200 flex items-center justify-center text-lilac-600 shrink-0">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium">Cursos</div>
                    <div className="text-lg font-bold text-ink-900 leading-tight">{assignedCourses.length}</div>
                  </div>
                </div>

                <div className="card p-3.5 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-center gap-3 shadow-2xs">
                  <div className="w-9 h-9 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] text-ink-500 font-medium">Clases</div>
                    <div className="text-lg font-bold text-ink-900 leading-tight">{totalClassesCount}</div>
                  </div>
                </div>
              </>
            )}

            {/* Hoja de vida card si no hay 4 cards llenas */}
            {(!isDoctor || !isTeacher) && (
              <div className="card p-3.5 bg-amber-50/40 border border-amber-100 rounded-2xl flex items-center gap-3 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-[11px] text-ink-500 font-medium">Hoja de Vida</div>
                  <div className="text-xs font-bold text-ink-900 leading-tight mt-1">
                    {teacher.cv_url ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 size={11} /> Subida
                      </span>
                    ) : (
                      <span className="text-ink-400 font-normal">Sin CV</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL UNIFICADO CON PESTAÑAS */}
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden">
        {/* Encabezado de Pestañas Integrado */}
        <div className="flex border-b border-lilac-100 bg-lilac-50/20 px-6 pt-3 gap-2 flex-wrap">
          {/* Pestaña: Atenciones a Pacientes (Si isDoctor) */}
          {isDoctor && (
            <button
              type="button"
              onClick={() => setActiveTab("atenciones")}
              className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
                activeTab === "atenciones"
                  ? "bg-white text-teal-800 border-t-2 border-l border-r border-teal-300 shadow-2xs -mb-px"
                  : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
              }`}
            >
              <Stethoscope size={16} className={activeTab === "atenciones" ? "text-teal-600" : "text-ink-400"} />
              <span>Atenciones a Pacientes ({assignedAppointments.length})</span>
            </button>
          )}

          {/* Pestaña: Cursos Asignados (Si isTeacher) */}
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab("cursos")}
                className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
                  activeTab === "cursos"
                    ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-300 shadow-2xs -mb-px"
                    : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
                }`}
              >
                <GraduationCap size={16} className={activeTab === "cursos" ? "text-lilac-600" : "text-ink-400"} />
                <span>Cursos Asignados ({assignedCourses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("clases")}
                className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
                  activeTab === "clases"
                    ? "bg-white text-blue-800 border-t-2 border-l border-r border-blue-300 shadow-2xs -mb-px"
                    : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
                }`}
              >
                <Calendar size={16} className={activeTab === "clases" ? "text-blue-600" : "text-ink-400"} />
                <span>Clases Dictadas ({totalClassesCount})</span>
              </button>
            </>
          )}

          {/* Pestaña: CV */}
          <button
            type="button"
            onClick={() => setActiveTab("cv")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "cv"
                ? "bg-white text-amber-800 border-t-2 border-l border-r border-amber-300 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <FileText size={16} className={activeTab === "cv" ? "text-amber-600" : "text-ink-400"} />
            <span>Hoja de Vida (CV)</span>
          </button>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="p-6">
          {/* TAB 1: ATENCIONES A PACIENTES */}
          {activeTab === "atenciones" && (
            <div className="space-y-4">
              {/* Filtros internos de citas */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-lilac-50/20 p-3 rounded-2xl border border-lilac-100">
                {/* Status Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { id: "all", label: `Todas (${assignedAppointments.length})` },
                    { id: "attended", label: `Atendidas (${attendedAppointments.length})` },
                    { id: "scheduled", label: `Agendadas (${assignedAppointments.filter(a => a.status === "scheduled").length})` },
                    { id: "no_show", label: `No asistió (${assignedAppointments.filter(a => a.status === "no_show").length})` },
                    { id: "cancelled", label: `Canceladas (${assignedAppointments.filter(a => a.status === "cancelled").length})` },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setApptStatusFilter(filter.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                        apptStatusFilter === filter.id
                          ? "bg-teal-600 text-white shadow-2xs"
                          : "text-ink-600 hover:text-ink-900 hover:bg-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar por paciente, motivo..."
                    value={apptSearch}
                    onChange={(e) => setApptSearch(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Lista o Tabla de Citas */}
              {filteredAppointments.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500 italic bg-teal-50/20 border border-teal-100/60 rounded-2xl">
                  {assignedAppointments.length === 0
                    ? "Este especialista no tiene citas ni atenciones a pacientes asignadas."
                    : "No se encontraron citas con los filtros aplicados."}
                </div>
              ) : (
                <div className="border border-lilac-100 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-lilac-50/60 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                        <tr>
                          <th className="text-left px-4 py-3">Fecha y Hora</th>
                          <th className="text-left px-4 py-3">Paciente</th>
                          <th className="text-left px-4 py-3">Motivo de Consulta</th>
                          <th className="text-left px-4 py-3">Ficha Clínica</th>
                          <th className="text-center px-4 py-3">Estado</th>
                          <th className="text-right px-4 py-3">Facturación SRI</th>
                          <th className="text-right px-4 py-3">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-lilac-50">
                        {filteredAppointments.map((appt) => {
                          const p = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
                          const hasFicha = Array.isArray(appt.dental_consultation)
                            ? appt.dental_consultation.length > 0
                            : !!appt.dental_consultation;

                          const inv = appt.invoice;

                          return (
                            <tr key={appt.id} className="hover:bg-teal-50/20 transition-colors">
                              <td className="px-4 py-3 font-semibold text-ink-900 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Clock size={13} className="text-teal-600" />
                                  <span>{formatDateTimeES(appt.starts_at)}</span>
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <div className="font-bold text-ink-950">
                                  {p?.full_name || "Paciente no especificado"}
                                </div>
                                <div className="text-[11px] text-ink-500 flex items-center gap-2">
                                  {p?.phone && <span>{p.phone}</span>}
                                  {p?.document_number && <span>• C.I. {p.document_number}</span>}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-ink-700 max-w-xs truncate">
                                {appt.reason || <span className="text-ink-400 italic">Sin motivo especificado</span>}
                              </td>

                              <td className="px-4 py-3">
                                {hasFicha ? (
                                  <Link
                                    href={`/erp/citas/${appt.id}/atencion`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition"
                                  >
                                    <CheckCircle size={12} />
                                    <span>Ficha Registrada</span>
                                  </Link>
                                ) : appt.status === "attended" ? (
                                  <Link
                                    href={`/erp/citas/${appt.id}/atencion`}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg hover:bg-amber-100 transition"
                                  >
                                    <span>Pendiente de Ficha</span>
                                  </Link>
                                ) : (
                                  <span className="text-[11px] text-ink-400 italic">—</span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {appt.status === "attended" && (
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                                    Atendida
                                  </span>
                                )}
                                {appt.status === "scheduled" && (
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 rounded-full">
                                    Agendada
                                  </span>
                                )}
                                {appt.status === "no_show" && (
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                                    No asistió
                                  </span>
                                )}
                                {appt.status === "cancelled" && (
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full">
                                    Cancelada
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {inv ? (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-emerald-800">
                                      {formatCurrency(inv.total)}
                                    </div>
                                    <Link
                                      href={`/erp/facturacion/${inv.id}`}
                                      className="text-[10px] text-lilac-700 hover:underline font-mono"
                                    >
                                      #{inv.invoice_number}
                                    </Link>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-ink-400 italic">Sin facturar</span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                <Link
                                  href={`/erp/citas/${appt.id}`}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 px-2.5 py-1 rounded-xl transition"
                                >
                                  <span>Ver Cita</span>
                                  <ExternalLink size={11} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CURSOS ASIGNADOS */}
          {activeTab === "cursos" && isTeacher && (
            <div className="space-y-4">
              {assignedCourses.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  Este docente no está asignado a ningún curso actualmente.
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {assignedCourses.map((c: any) => (
                    <div key={c.id} className="p-4 bg-white border border-lilac-100 rounded-2xl shadow-2xs flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-lilac-700 bg-lilac-50 border border-lilac-100 px-2 py-0.5 rounded-md">
                            {c.role === "principal" ? "Docente Principal" : c.role || "Docente"}
                          </span>
                          <span className="text-[11px] text-ink-400 font-medium">
                            {c.cursos?.status === "active" ? "🟢 Abierto" : c.cursos?.status === "in_progress" ? "🔵 En Ejecución" : "⚪ Finalizado"}
                          </span>
                        </div>
                        <h3 className="font-bold text-ink-950 text-sm mt-2">{c.cursos?.name}</h3>
                        <p className="text-xs text-ink-500 mt-1 line-clamp-2">{c.cursos?.description || "Sin descripción"}</p>
                      </div>

                      <div className="pt-2 border-t border-lilac-50 flex items-center justify-between">
                        <span className="text-[11px] text-ink-400 font-mono">
                          {c.cursos?.start_date && formatDateES(c.cursos.start_date)}
                        </span>
                        <Link href={`/erp/cursos/${c.course_id}`} className="text-xs font-bold text-lilac-600 hover:text-lilac-800 flex items-center gap-1">
                          <span>Ver Curso</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLASES DICTADAS */}
          {activeTab === "clases" && isTeacher && (
            <div className="space-y-4">
              {assignedClasses.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500 italic bg-blue-50/20 border border-blue-100/60 rounded-2xl">
                  No hay clases programadas registradas para este docente.
                </div>
              ) : (
                <div className="border border-lilac-100 rounded-2xl overflow-hidden divide-y divide-lilac-50">
                  {assignedClasses.map((cls: any) => (
                    <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-lilac-50/10 transition-colors">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-ink-950 flex items-center gap-2">
                          <span>{cls.title || "Clase Programada"}</span>
                          <span className="text-[10px] font-semibold text-ink-500 bg-lilac-50 px-2 py-0.2 rounded-md">
                            Módulo: {cls.curso_modulos?.name || "General"}
                          </span>
                        </div>
                        <div className="text-[11px] text-ink-500 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-lilac-600" />
                            {formatDateES(cls.date)} ({cls.start_time} - {cls.end_time})
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/erp/cursos/clases?tab=clases&course_id=${cls.curso_modulos?.course_id}&module_id=${cls.module_id}&class_id=${cls.id}`}
                        className="btn-secondary text-xs py-1 px-3 flex items-center gap-1 font-semibold"
                      >
                        <span>Ir a la Clase</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: HOJA DE VIDA (CV) */}
          {activeTab === "cv" && (
            <div className="space-y-4">
              <div className="p-6 bg-lilac-50/20 border border-lilac-100 rounded-2xl space-y-4">
                <h3 className="font-bold text-ink-950 text-sm flex items-center gap-2">
                  <FileText size={16} className="text-lilac-600" />
                  Documento de Hoja de Vida (CV)
                </h3>

                {teacher.cv_url ? (
                  <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-lilac-200 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink-900">Hoja de Vida Registrada</p>
                        <p className="text-[11px] text-ink-500">Documento PDF / Word adjunto</p>
                      </div>
                    </div>

                    <a
                      href={teacher.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary text-xs py-2 px-4 shadow-sm inline-flex items-center gap-1.5"
                    >
                      <Download size={14} />
                      <span>Ver / Descargar CV</span>
                    </a>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-ink-500 italic bg-white border border-lilac-100 rounded-2xl">
                    No se ha subido la Hoja de Vida (CV) para este especialista. Haz clic en "Editar Perfil" en la ficha para adjuntar el archivo.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL POPUP PARA EDITAR ESPECIALISTA */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-lilac-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <h3 className="font-bold text-ink-950 text-base">Editar Perfil del Especialista</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingModalOpen(false);
                  setPreviewPhotoUrl(null);
                  setModalError(null);
                }}
                className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleUpdateSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              <input type="hidden" name="id" value={teacher.id} />
              <input type="hidden" name="existingPhotoUrl" value={teacher.photo_url || ""} />
              <input type="hidden" name="existingCvUrl" value={teacher.cv_url || ""} />

              {modalError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Roles / Checks de Especialista */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  Roles y Áreas de Participación *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      editIsDoctor
                        ? "border-teal-400 bg-teal-50/50 text-teal-950 shadow-2xs"
                        : "border-lilac-100 bg-white hover:bg-lilac-50/30 text-ink-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="is_doctor"
                      checked={editIsDoctor}
                      onChange={(e) => setEditIsDoctor(e.target.checked)}
                      className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <div className="font-bold flex items-center gap-1">
                        <Stethoscope size={13} className="text-teal-600 shrink-0" />
                        <span>Atención a Pacientes</span>
                      </div>
                      <p className="text-[11px] text-ink-500 mt-0.5 leading-tight">
                        Habilitado para atender consultas y citas en clínica.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      editIsTeacher
                        ? "border-lilac-400 bg-lilac-50/50 text-lilac-950 shadow-2xs"
                        : "border-lilac-100 bg-white hover:bg-lilac-50/30 text-ink-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="is_teacher"
                      checked={editIsTeacher}
                      onChange={(e) => setEditIsTeacher(e.target.checked)}
                      className="mt-0.5 rounded text-lilac-600 focus:ring-lilac-500 h-4 w-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <div className="font-bold flex items-center gap-1">
                        <GraduationCap size={13} className="text-lilac-600 shrink-0" />
                        <span>Profesor / Cursos</span>
                      </div>
                      <p className="text-[11px] text-ink-500 mt-0.5 leading-tight">
                        Habilitado para impartir cursos y clases académicas.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Avatar Interactivo de Edición de Foto */}
              <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-lilac-200 shadow-md bg-lilac-50 flex items-center justify-center">
                    {previewPhotoUrl || teacher.photo_url ? (
                      <img
                        src={previewPhotoUrl || proxyStorageUrl(teacher.photo_url)}
                        alt={teacher.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-lilac-100 flex items-center justify-center text-lilac-600 font-bold text-2xl">
                        {teacher.full_name?.charAt(0).toUpperCase() || <UserCheck size={36} />}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    title="Cambiar foto de perfil"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="text-[11px] text-ink-500 font-medium">Haz clic en el lápiz para seleccionar una nueva foto</p>
                <input
                  ref={fileInputRef}
                  name="photoFile"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Nombre completo *</label>
                <input name="fullName" defaultValue={teacher.full_name} required className="input text-xs" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Especialidad</label>
                <input name="specialty" defaultValue={teacher.specialty || ""} placeholder="Ej: Implantología, Ortodoncia" className="input text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Teléfono</label>
                  <input name="phone" defaultValue={teacher.phone || ""} placeholder="Ej: 0998765432" className="input text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Correo electrónico</label>
                  <input name="email" type="email" defaultValue={teacher.email || ""} placeholder="Ej: especialista@facop.com" className="input text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center gap-1">
                  <FileText size={13} className="text-lilac-600" /> Hoja de Vida / CV (Documento opcional)
                </label>
                {teacher.cv_url && (
                  <div className="mb-2 p-2 bg-lilac-50/50 rounded-xl border border-lilac-100">
                    <a href={teacher.cv_url} target="_blank" rel="noopener noreferrer" className="text-xs text-lilac-700 font-semibold hover:underline inline-flex items-center gap-1">
                      <FileText size={13} /> Ver CV actual cargado
                    </a>
                  </div>
                )}
                <input
                  name="cvFile"
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  className="w-full text-xs text-ink-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-lilac-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingModalOpen(false);
                    setPreviewPhotoUrl(null);
                    setModalError(null);
                  }}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs px-5 py-2 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
