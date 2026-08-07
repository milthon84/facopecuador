"use client";

import { useState } from "react";
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
  const router = useRouter();

  const totalClassesCount = assignedClasses.length;

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
              {teacher.photo_url ? (
                <img
                  src={teacher.photo_url}
                  alt={teacher.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-lilac-200 shadow-2xs shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-600 font-bold shrink-0">
                  <UserCheck size={24} />
                </div>
              )}

              <div className="space-y-1">
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
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <Calendar size={16} />
            <span>Clases Impartidas ({assignedClasses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cv")}
            className={`flex items-center gap-2 px-5 py-3 font-bold text-xs rounded-t-2xl transition cursor-pointer ${
              activeTab === "cv"
                ? "bg-white text-lilac-800 border-t-2 border-l border-r border-lilac-200 shadow-2xs -mb-px"
                : "text-ink-600 hover:text-ink-900 hover:bg-white/60"
            }`}
          >
            <FileText size={16} />
            <span>Hoja de Vida y Archivos</span>
          </button>
        </div>

        {/* Cuerpo de la Pestaña Activa */}
        <div className="p-6">
          {/* TAB 1: CURSOS ASIGNADOS */}
          {activeTab === "cursos" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {assignedCourses.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  El profesor no está asignado a ningún curso actualmente.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignedCourses.map((assoc: any) => {
                    const curso = assoc.cursos;
                    if (!curso) return null;

                    return (
                      <div key={assoc.id} className="p-4 bg-white border border-lilac-100 rounded-2xl shadow-2xs space-y-3 hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold text-lilac-800 bg-lilac-50 border border-lilac-100 px-2.5 py-0.5 rounded-full capitalize">
                            {assoc.role === "principal" ? "Docente Principal" : assoc.role === "auxiliar" ? "Docente Auxiliar" : "Invitado"}
                          </span>
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 capitalize">
                            {curso.status === "draft" ? "Borrador" : curso.status === "active" ? "Abierto" : curso.status === "in_progress" ? "En Ejecución" : "Finalizado"}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-ink-950 text-sm leading-snug line-clamp-1">{curso.name}</h4>
                          <p className="text-xs text-ink-500 mt-1 line-clamp-2">{curso.description || "Sin descripción disponible."}</p>
                        </div>

                        <div className="pt-2 border-t border-lilac-50 flex items-center justify-between text-xs">
                          <span className="text-ink-500 font-medium">Inicio: {formatDateES(curso.start_date)}</span>
                          <Link
                            href={`/erp/cursos/${curso.id}`}
                            className="inline-flex items-center gap-1 text-lilac-700 hover:text-lilac-900 font-bold"
                          >
                            <span>Gestionar</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLASES IMPARTIDAS */}
          {activeTab === "clases" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {assignedClasses.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-500 italic bg-lilac-50/20 border border-lilac-100/60 rounded-2xl">
                  No hay clases ni sesiones registradas a cargo de este profesor.
                </div>
              ) : (
                <div className="border border-lilac-100 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
                      <tr>
                        <th className="text-left px-5 py-3">Curso & Módulo</th>
                        <th className="text-left px-5 py-3">Clase / Tema</th>
                        <th className="text-left px-5 py-3">Fecha y Horario</th>
                        <th className="text-left px-5 py-3">Aula</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lilac-50">
                      {assignedClasses.map((clase: any) => {
                        const mod = clase.curso_modulos;
                        const curso = mod?.cursos;

                        return (
                          <tr key={clase.id} className="hover:bg-lilac-50/10">
                            <td className="px-5 py-3">
                              <div className="font-bold text-ink-950">{curso?.name || "Curso"}</div>
                              <div className="text-[10px] text-lilac-700 font-semibold">
                                Módulo {mod?.number}: {mod?.name}
                              </div>
                            </td>
                            <td className="px-5 py-3 font-semibold text-ink-900">
                              {clase.title}
                            </td>
                            <td className="px-5 py-3 text-ink-700">
                              <div className="font-medium">{clase.date ? formatDateES(clase.date) : "-"}</div>
                              {clase.start_time && (
                                <div className="text-[10px] text-ink-400 font-semibold">
                                  {clase.start_time} - {clase.end_time}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3 text-ink-600 font-medium">
                              {clase.classroom || "Laboratorio Principal"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HOJA DE VIDA (CV) */}
          {activeTab === "cv" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-6 bg-lilac-50/20 border border-lilac-100 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-ink-950 flex items-center gap-2">
                  <FileText size={18} className="text-lilac-600" /> Documentación Académica y Hoja de Vida
                </h3>

                {teacher.cv_url ? (
                  <div className="p-5 bg-white border border-lilac-100 rounded-2xl flex items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-lilac-50 text-lilac-700 flex items-center justify-center shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-ink-950 text-sm">Hoja de Vida de {teacher.full_name}</div>
                        <div className="text-xs text-ink-500 font-medium">Documento adjunto en PDF / Word</div>
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
                onClick={() => setIsEditingModalOpen(false)}
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
                  <Camera size={13} className="text-lilac-600" /> Foto del Profesor (Imagen opcional)
                </label>
                {teacher.photo_url && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-lilac-50/50 rounded-xl border border-lilac-100">
                    <img src={teacher.photo_url} alt="Foto actual" className="w-10 h-10 rounded-full object-cover border border-lilac-200" />
                    <span className="text-[11px] text-ink-600 font-medium">Foto registrada (Subir otra para actualizar)</span>
                  </div>
                )}
                <input
                  name="photoFile"
                  type="file"
                  accept="image/*"
                  className="w-full text-xs text-ink-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
                />
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
                  onClick={() => setIsEditingModalOpen(false)}
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
