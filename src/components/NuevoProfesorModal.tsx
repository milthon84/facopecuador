"use client";

import { useState } from "react";
import { Plus, X, Award, Camera, FileText } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  action: (formData: FormData) => Promise<void>;
}

export default function NuevoProfesorModal({ action }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    try {
      await action(formData);
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "No se pudo registrar el profesor.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
      >
        <Plus size={16} />
        <span>Registrar Nuevo Profesor</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-lilac-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/40">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center font-bold">
                  <Award size={18} />
                </div>
                <h3 className="font-bold text-ink-950 text-base">Registrar Nuevo Profesor</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-ink-400 hover:text-ink-700 p-1.5 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Nombre completo *</label>
                <input
                  name="fullName"
                  required
                  placeholder="Ej: Alejandro Peralta"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Especialidad</label>
                <input
                  name="specialty"
                  placeholder="Ej: Implantología, Ortodoncia"
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Teléfono</label>
                  <input
                    name="phone"
                    placeholder="Ej: 0998765432"
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">Correo electrónico</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="Ej: profesor@facop.com"
                    className="input text-xs"
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
                  className="w-full text-xs text-ink-600 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-lilac-50 file:text-lilac-700 hover:file:bg-lilac-100 bg-white border border-lilac-200 rounded-xl p-1 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-lilac-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
                  {loading ? "Guardando..." : "Registrar Profesor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
