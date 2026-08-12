"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  UserCheck,
  X,
  Search,
  Loader2,
  AlertCircle,
  Users,
  Check,
} from "lucide-react";
import {
  enrollStudentInCourseAction,
  registerAndEnrollStudentAction,
} from "@/app/(admin)/erp/cursos/actions";

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

export default function EnrollStudentModal({
  courseId,
  courseName,
  allStudents,
  enrolledStudentIds,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Selection state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Form Nuevo
  const [fullName, setFullName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");

  const enrolledSet = new Set(enrolledStudentIds);
  const availableStudents = allStudents.filter((s) => !enrolledSet.has(s.id));
  const filteredStudents =
    searchQuery.trim() === ""
      ? availableStudents
      : availableStudents.filter(
          (s) =>
            s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.document_number.toLowerCase().includes(searchQuery.toLowerCase())
        );

  // Auto-focus al abrir modal en tab existente
  useEffect(() => {
    if (open && activeTab === "existing") {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open, activeTab]);

  function resetExistingForm() {
    setSelectedStudent(null);
    setSearchQuery("");
  }

  function handleClose() {
    setOpen(false);
    resetExistingForm();
    setErrorMsg(null);
  }

  async function handleEnrollExisting(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedStudent) {
      setErrorMsg("Selecciona un alumno de la lista.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      await enrollStudentInCourseAction(selectedStudent.id, courseId);
      handleClose();
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
        courseId,
      });
      handleClose();
      setFullName("");
      setDocNumber("");
      setPhone("");
      setEmail("");
      setTitle("");
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">

            {/* Header compacto */}
            <div className="px-5 py-3.5 border-b border-lilac-100 bg-lilac-50/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-xs">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-ink-950 text-sm">Registrar Alumno en Curso</h3>
                  <p className="text-[11px] text-ink-500 line-clamp-1">{courseName}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-lilac-100/50 rounded-xl transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs compactos */}
            <div className="flex border-b border-lilac-100 bg-lilac-50/20 text-xs font-semibold shrink-0">
              <button
                onClick={() => { setActiveTab("existing"); setErrorMsg(null); }}
                className={`flex-1 py-2 text-center transition border-b-2 ${
                  activeTab === "existing"
                    ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                🔍 Alumno Existente
              </button>
              <button
                onClick={() => { setActiveTab("new"); setErrorMsg(null); }}
                className={`flex-1 py-2 text-center transition border-b-2 ${
                  activeTab === "new"
                    ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                    : "border-transparent text-ink-500 hover:text-ink-800"
                }`}
              >
                ✨ Registrar Nuevo Alumno
              </button>
            </div>

            {/* Contenido principal con scroll flexible */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">

              {activeTab === "existing" ? (
                <form onSubmit={handleEnrollExisting} className="flex flex-col h-full space-y-3">

                  {availableStudents.length === 0 ? (
                    <div className="py-10 text-center text-ink-400">
                      <Users size={36} className="mx-auto mb-2 opacity-40 text-lilac-400" />
                      <p className="text-xs font-semibold text-ink-700">Todos los alumnos ya están matriculados</p>
                      <p className="text-[11px] mt-1 text-ink-400">No quedan más alumnos registrados por agregar a este curso.</p>
                    </div>
                  ) : (
                    <>
                      {/* Buscador Integrado Flex (Sin superposición de texto) */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-lilac-50/40 border border-lilac-200 rounded-xl focus-within:bg-white focus-within:border-lilac-500 focus-within:ring-2 focus-within:ring-lilac-200 transition shrink-0">
                        <Search size={15} className="text-lilac-600 shrink-0" />
                        <input
                          ref={searchRef}
                          type="text"
                          placeholder="Buscar por nombre o número de cédula..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-transparent text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                            className="p-0.5 text-ink-400 hover:text-ink-700 rounded transition shrink-0"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Sub-header con información de selección */}
                      <div className="flex items-center justify-between text-[11px] text-ink-500 px-0.5 shrink-0">
                        <span>
                          {filteredStudents.length} alumno{filteredStudents.length !== 1 ? "s" : ""} disponible{filteredStudents.length !== 1 ? "s" : ""}
                        </span>
                        {selectedStudent && (
                          <span className="text-lilac-700 font-semibold flex items-center gap-1">
                            <Check size={12} /> Seleccionado: {selectedStudent.full_name}
                          </span>
                        )}
                      </div>

                      {/* Lista de Alumnos Integrada en la Pantalla */}
                      <div className="border border-lilac-100 rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto divide-y divide-lilac-50 shadow-xs">
                        {filteredStudents.length === 0 ? (
                          <div className="p-6 text-center text-xs text-ink-400">
                            <Search size={20} className="mx-auto mb-1.5 opacity-30 text-lilac-400" />
                            No se encontró ningún alumno que coincida con <strong>"{searchQuery}"</strong>
                          </div>
                        ) : (
                          filteredStudents.map((s) => {
                            const isSelected = selectedStudent?.id === s.id;
                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setSelectedStudent(s);
                                  setErrorMsg(null);
                                }}
                                onDoubleClick={() => {
                                  setSelectedStudent(s);
                                  handleEnrollExisting();
                                }}
                                className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition select-none ${
                                  isSelected
                                    ? "bg-lilac-100/70 border-l-4 border-l-lilac-600 text-ink-950 font-medium"
                                    : "hover:bg-lilac-50/60 text-ink-800"
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition ${
                                      isSelected
                                        ? "bg-lilac-600 text-white"
                                        : "bg-lilac-100 text-lilac-700"
                                    }`}
                                  >
                                    {s.full_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold truncate leading-tight">
                                      {s.full_name}
                                    </p>
                                    <p className="text-[11px] text-ink-400 truncate mt-0.5">
                                      C.I: <span className="font-mono text-ink-600">{s.document_number}</span>
                                      {s.phone ? ` • Tel: ${s.phone}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <div className="shrink-0 pl-2">
                                  {isSelected ? (
                                    <div className="w-5 h-5 rounded-full bg-lilac-600 text-white flex items-center justify-center">
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 rounded-full border border-lilac-200 hover:border-lilac-400 transition" />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <p className="text-[10px] text-ink-400 italic px-0.5">
                        💡 Tip: Puedes hacer doble clic en un alumno para matricularlo directamente.
                      </p>
                    </>
                  )}

                  {errorMsg && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 shrink-0">
                      <AlertCircle size={14} className="shrink-0" /> {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-lilac-100 shrink-0">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="btn-secondary text-xs py-2 px-3.5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !selectedStudent || availableStudents.length === 0}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      Matricular en Curso
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegisterAndEnroll} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="label text-ink-800 text-[11px] mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Andrea Castro"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800 text-[11px] mb-1">Cédula / RUC / Pasaporte *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1712345678"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="label text-ink-800 text-[11px] mb-1">Teléfono *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 0991234567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                    <div>
                      <label className="label text-ink-800 text-[11px] mb-1">Correo Electrónico *</label>
                      <input
                        type="email"
                        required
                        placeholder="ejemplo@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input text-xs py-2"
                      />
                    </div>
                  </div>



                  {errorMsg && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} className="shrink-0" /> {errorMsg}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-lilac-100">
                    <button
                      type="button"
                      onClick={handleClose}
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
