"use client";

import { useState, useRef } from "react";
import { 
  Award, GraduationCap, Calendar, FileText, Pencil, ArrowLeft, Mail, Phone, 
  UserCheck, ExternalLink, Download, CheckCircle2, X, Camera
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  teacher: any;
  assignedCourses: any[];
  assignedClasses: any[];
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

export default function TeacherDetailClient({
  teacher,
  assignedCourses,
  assignedClasses,
  canEdit,
  editMode,
  updateTeacherAction,
}: Props) {
  const [activeTab, setActiveTab] = useState<"cursos" | "clases" | "cv">("cursos");
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(editMode);
  const [loading, setLoading] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalClassesCount = assignedClasses.length;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewPhotoUrl(URL.createObjectURL(file));
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await updateTeacherAction(formData);
      setIsEditingModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-6">
      {/* Botón Volver */}
      <Link href="/erp/cursos/profesores" className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink-900 transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-lilac-100 shadow-2xs w-fit">
        <ArrowLeft size={14} />
        <span>Volver al Directorio de Profesores</span>
      </Link>

      {/* Ficha Principal del Profesor & Tarjetas KPI */}
      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Columna Izquierda: Ficha de Profesor */}
        <div className="md:col-span-1">
          <div className="card p-5 bg-white border border-lilac-100 shadow-sm rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-lilac-50 pb-2">
              <span className="text-xs font-bold text-ink-400 uppercase tracking-wider">Ficha de Profesor</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsEditingModalOpen(true)}
                  className="text-xs text-gold-600 hover:text-gold-700 font-bold flex items-center gap-1 cursor-pointer bg-gold-50 border border-gold-200 px-2.5 py-1 rounded-xl transition"
                >
                  <Pencil size={12} />
                  <span>Editar Perfil</span>
                </button>
              )}
            </div>

            <div className="flex items-start gap-3">
              {/* Foto con lápiz overlay interactivo */}
              <div
                onClick={() => canEdit && setIsEditingModalOpen(true)}
                className={`relative group shrink-0 ${canEdit ? "cursor-pointer" : ""}`}
                title={canEdit ? "Haz clic para cambiar foto de perfil" : ""}
              >
                {teacher.photo_url ? (
                  <img
                    src={teacher.photo_url}
                    alt={teacher.full_name}
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

              <div className="space-y-1 min-w-0 flex-1">
                <h1 className="text-base font-bold text-ink-950 leading-snug">{teacher.full_name}</h1>
                {teacher.specialty && (
                  <span className="inline-block text-[11px] font-semibold text-lilac-700 bg-lilac-50 border border-lilac-100 px-2 py-0.5 rounded-lg">
                    {teacher.specialty}
                  </span>
                )}
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
                  href={teacher.cv_url}
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

        {/* Columna Derecha: KPI Cards */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 bg-lilac-50/50 border border-lilac-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-lilac-200 flex items-center justify-center text-lilac-600 shrink-0">
                <GraduationCap size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Cursos Asignados</div>
                <div className="text-xl font-bold text-ink-900 leading-tight">{assignedCourses.length}</div>
              </div>
            </div>

            <div className="card p-4 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Clases Programadas</div>
                <div className="text-xl font-bold text-ink-900 leading-tight">{totalClassesCount}</div>
              </div>
            </div>

            <div className="card p-4 bg-green-50/40 border border-green-100 rounded-2xl flex items-center gap-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-white border border-green-200 flex items-center justify-center text-green-600 shrink-0">
                <Award size={20} />
              </div>
              <div>
                <div className="text-xs text-ink-500 font-medium">Hoja de Vida</div>
                <div className="text-sm font-bold text-ink-900 leading-tight mt-1">
                  {teacher.cv_url ? (
                    <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200 text-xs font-bold inline-flex items-center gap-1">
                      <CheckCircle2 size={12} /> Disponible
                    </span>
                  ) : (
                    <span className="text-ink-400 text-xs font-normal">Sin CV</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL UNIFICADO CON PESTAÑAS */}
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden">
        {/* Encabezado de Pestañas Integrado */}
        <div className="flex border-b border-lilac-100 bg-lilac-50/20 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("cursos")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "cursos"
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <GraduationCap size={16} />
            <span>Cursos Asignados ({assignedCourses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("clases")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "clases"
                ? "bg-white text-blue-800 border-t-2 border-l border-r border-blue-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <Calendar size={16} />
            <span>Clases Dictadas ({totalClassesCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cv")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "cv"
                ? "bg-white text-green-800 border-t-2 border-l border-r border-green-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <FileText size={16} />
            <span>Hoja de Vida (CV)</span>
          </button>
        </div>

        {/* Contenido de la Pestaña Activa */}
        <div className="p-6">
          {activeTab === "cursos" && (
            <div className="space-y-4">
              {assignedCourses.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  Este profesor no está asignado a ningún curso actualmente.
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

          {activeTab === "clases" && (
            <div className="space-y-4">
              {assignedClasses.length === 0 ? (
                <div className="p-8 text-center text-sm text-ink-500 italic bg-blue-50/20 border border-blue-100/60 rounded-2xl">
                  No hay clases programadas registradas para este profesor.
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
                      <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">
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
                    No se ha subido la Hoja de Vida (CV) para este profesor. Haz clic en "Editar Perfil" en la ficha del profesor para adjuntar el archivo.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL POPUP PARA EDITAR PROFESOR */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gold-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-lilac-100 flex items-center justify-between bg-gold-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gold-100 text-gold-700 flex items-center justify-center font-bold">
                  <Pencil size={16} />
                </div>
                <h3 className="font-bold text-ink-950 text-base">Editar Perfil del Profesor</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingModalOpen(false);
                  setPreviewPhotoUrl(null);
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

              {/* Avatar Interactivo de Edición de Foto */}
              <div className="flex flex-col items-center justify-center py-2 space-y-1.5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-lilac-200 shadow-md bg-lilac-50 flex items-center justify-center">
                    {previewPhotoUrl || teacher.photo_url ? (
                      <img
                        src={previewPhotoUrl || teacher.photo_url}
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
                  <input name="email" type="email" defaultValue={teacher.email || ""} placeholder="Ej: profesor@facop.com" className="input text-xs" />
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
