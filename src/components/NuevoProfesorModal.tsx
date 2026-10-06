"use client";

import { useState } from "react";
import { Plus, Award, AlertCircle, Loader2, FileText, Stethoscope, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import StandardModal from "@/components/StandardModal";

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export default function NuevoProfesorModal({ action }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDoctor, setIsDoctor] = useState(true);
  const [isTeacher, setIsTeacher] = useState(true);
  const router = useRouter();

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isDoctor && !isTeacher) {
      setErrorMsg("Debes seleccionar al menos un rol (Atención a Pacientes o Profesor / Cursos).");
      return;
    }
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "No se pudo registrar el especialista.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null);
          setIsDoctor(true);
          setIsTeacher(true);
          setIsOpen(true);
        }}
        className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <Plus size={16} />
        <span>Registrar Especialista</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Registrar Nuevo Especialista"
        subtitle="Ingresa los datos personales, especialidad y asigna sus roles clínicos/académicos"
        icon={<Award size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
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
                  isDoctor
                    ? "border-teal-400 bg-teal-50/50 text-teal-950 shadow-2xs"
                    : "border-lilac-100 bg-white hover:bg-lilac-50/30 text-ink-700"
                }`}
              >
                <input
                  type="checkbox"
                  name="is_doctor"
                  checked={isDoctor}
                  onChange={(e) => setIsDoctor(e.target.checked)}
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
                  isTeacher
                    ? "border-lilac-400 bg-lilac-50/50 text-lilac-950 shadow-2xs"
                    : "border-lilac-100 bg-white hover:bg-lilac-50/30 text-ink-700"
                }`}
              >
                <input
                  type="checkbox"
                  name="is_teacher"
                  checked={isTeacher}
                  onChange={(e) => setIsTeacher(e.target.checked)}
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

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Nombre completo *</label>
            <input
              name="fullName"
              required
              disabled={loading}
              placeholder="Ej: Dr. Alejandro Peralta"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Especialidad</label>
            <input
              name="specialty"
              disabled={loading}
              placeholder="Ej: Implantología Oral, Ortodoncia"
              className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Teléfono</label>
              <input
                name="phone"
                disabled={loading}
                placeholder="Ej: 0998765432"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Correo electrónico</label>
              <input
                name="email"
                type="email"
                disabled={loading}
                placeholder="Ej: especialista@facop.com"
                className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center gap-1">
              <FileText size={13} className="text-lilac-600" /> Hoja de Vida / CV (PDF u Opcional)
            </label>
            <input
              name="cvFile"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              disabled={loading}
              className="w-full text-xs text-ink-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Registrar Especialista</span>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
