"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, X, Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { enrollStudentInCourseAction, registerAndEnrollStudentAction } from "@/app/(admin)/erp/cursos/actions";

interface StudentOption {
  id: string;
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
}

interface Props {
  courseId: string;
  courseName: string;
  allStudents: StudentOption[];
  enrolledStudentIds: string[];
}

export default function EnrollStudentModal({ courseId, courseName, allStudents, enrolledStudentIds }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("new");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Existente
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Form Nuevo
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const enrolledSet = new Set(enrolledStudentIds);
  const availableStudents = allStudents.filter((s) => !enrolledSet.has(s.id));
  const filteredAvailable = availableStudents.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.document_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleEnrollExisting(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMsg("Selecciona un alumno de la lista.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await enrollStudentInCourseAction(selectedStudentId, courseId);
      setOpen(false);
      setSelectedStudentId("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al matricular el alumno.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterAndEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !docNumber.trim() || !phone.trim() || !email.trim()) {
      setErrorMsg("Completa todos los campos obligatorios (*).");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await registerAndEnrollStudentAction({
        fullName: fullName.trim(),
        documentNumber: docNumber.trim(),
        phone: phone.trim(),
        email: email.trim(),
        professionalTitle: title.trim() || undefined,
        notes: notes.trim() || undefined,
        courseId,
      });

      setOpen(false);
      setFullName("");
      setDocNumber("");
      setPhone("");
      setEmail("");
      setTitle("");
      setNotes("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar y matricular.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setErrorMsg(null);
        }}
        className="btn-primary text-xs py-2 px-3.5 shadow-sm flex items-center gap-1.5"
      >
        <UserPlus size={14} /> Registro de Alumno al Curso
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-lilac-100 bg-lilac-50/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-xs">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-ink-950 text-sm">Registrar Alumno en Curso</h3>
                  <p className="text-[11px] text-ink-500 line-clamp-1">{courseName}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-lilac-100/50 rounded-xl transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pestañas de Opción */}
            <div className="flex border-b border-lilac-100 bg-lilac-50/20 text-xs font-semibold">
              <button
                onClick={() => {
                  setActiveTab("existing");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 text-center transition border-b-2 ${
                  activeTab === "existing"
                    ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                🔍 Alumno Existente
              </button>
              <button
                onClick={() => {
                  setActiveTab("new");
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 text-center transition border-b-2 ${
                  activeTab === "new"
                    ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                ✨ Registrar Nuevo Alumno
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 space-y-4">
              
              {activeTab === "existing" ? (
                <form onSubmit={handleEnrollExisting} className="space-y-4">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o cédula..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input pl-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="label text-ink-800 font-semibold">Seleccionar Alumno (*)</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      required
                      className="input text-xs"
                    >
                      <option value="">-- Selecciona un alumno no matriculado --</option>
                      {filteredAvailable.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.document_number})
                        </option>
                      ))}
                    </select>
                    {availableStudents.length === 0 && (
                      <p className="text-[11px] text-ink-500 italic mt-1">
                        Todos los alumnos registrados ya se encuentran matriculados en este curso.
                      </p>
                    )}
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} /> {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-lilac-50">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="btn-secondary text-xs py-2 px-3.5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !selectedStudentId}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      Matricular en Curso
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterAndEnroll} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-ink-800">Nombre Completo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Dra. Andrea Castro"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800">Cédula / RUC / Pasaporte *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1712345678"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label text-ink-800">Teléfono *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 0991234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800">Correo Electrónico *</label>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label text-ink-800">Título Profesional / Especialidad</label>
                    <input
                      type="text"
                      placeholder="Ej: Odontóloga General, Especialista en Endodoncia"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="input text-xs"
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} /> {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-lilac-50">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="btn-secondary text-xs py-2 px-3.5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      Registrar y Matricular
                    </button>
                  </div>
                </form>
              )}

            </div>

          </div>
        </div>
      )}
    </>
  );
}
