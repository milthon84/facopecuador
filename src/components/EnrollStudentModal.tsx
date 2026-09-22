"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  UserCheck,
  Search,
  Loader2,
  AlertCircle,
  Users,
  Check,
  X,
} from "lucide-react";
import {
  enrollStudentInCourseAction,
  registerAndEnrollStudentAction,
} from "@/app/(admin)/erp/cursos/actions";
import StandardModal from "@/components/StandardModal";

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
    if (loading) return;
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
      const msg = err?.message || String(err);
      if (msg.includes("webpack") || msg.includes("is not a function")) {
        setErrorMsg("El sistema fue actualizado. Por favor recarga la página (F5) para procesar la solicitud.");
      } else {
        setErrorMsg(msg || "Error al registrar y matricular.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErrorMsg(null);
        }}
        className="btn-primary text-xs py-2 px-3.5 shadow-sm flex items-center gap-1.5 cursor-pointer"
      >
        <UserPlus size={14} /> <span>Registro de Alumno al Curso</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={handleClose}
        title="Registrar Alumno en Curso"
        subtitle={courseName}
        icon={<UserPlus size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-xl"
      >
        {/* Tabs compactos */}
        <div className="flex border-b border-lilac-100 bg-lilac-50/30 text-xs font-semibold -mx-6 -mt-4 mb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("existing");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 text-center transition border-b-2 cursor-pointer ${
              activeTab === "existing"
                ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            🔍 Alumno Existente
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("new");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 text-center transition border-b-2 cursor-pointer ${
              activeTab === "new"
                ? "border-lilac-600 text-lilac-700 font-bold bg-white"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            ✨ Registrar Nuevo Alumno
          </button>
        </div>

        {activeTab === "existing" ? (
          <form onSubmit={handleEnrollExisting} className="space-y-3">
            {availableStudents.length === 0 ? (
              <div className="py-10 text-center text-ink-400">
                <Users size={36} className="mx-auto mb-2 opacity-40 text-lilac-400" />
                <p className="text-xs font-semibold text-ink-700">Todos los alumnos ya están matriculados</p>
                <p className="text-[11px] mt-1 text-ink-400">No quedan más alumnos registrados por agregar a este curso.</p>
              </div>
            ) : (
              <>
                {/* Buscador */}
                <div className="flex items-center gap-2 px-3 py-2 bg-lilac-50/40 border border-lilac-200 rounded-xl focus-within:bg-white focus-within:border-lilac-500 focus-within:ring-2 focus-within:ring-lilac-200 transition shrink-0">
                  <Search size={15} className="text-lilac-600 shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Buscar por nombre o número de cédula..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={loading}
                    className="w-full bg-transparent text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        searchRef.current?.focus();
                      }}
                      className="p-0.5 text-ink-400 hover:text-ink-700 rounded transition shrink-0 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Sub-header info */}
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

                {/* Lista */}
                <div className="border border-lilac-100 rounded-xl overflow-hidden bg-white max-h-56 overflow-y-auto divide-y divide-lilac-50 shadow-xs">
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
                            if (!loading) {
                              setSelectedStudent(s);
                              setErrorMsg(null);
                            }
                          }}
                          onDoubleClick={() => {
                            if (!loading) {
                              setSelectedStudent(s);
                              handleEnrollExisting();
                            }
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
                <AlertCircle size={14} className="shrink-0" /> <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !selectedStudent || availableStudents.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                <span>Matricular en Curso</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterAndEnroll} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-ink-800 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="Ej: Andrea Castro"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-800 mb-1">Cédula / RUC / Pasaporte *</label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="Ej: 1712345678"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-lilac-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-ink-800 mb-1">Teléfono *</label>
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="Ej: 0991234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-ink-800 mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  disabled={loading}
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" /> <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                <span>Registrar y Matricular</span>
              </button>
            </div>
          </form>
        )}
      </StandardModal>
    </>
  );
}
