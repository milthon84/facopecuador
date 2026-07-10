"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateDocumento, isPassportDocument } from "@/lib/validators";
import {
  Pencil,
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  Mail,
  IdCard,
} from "lucide-react";

interface Patient {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  document_number?: string | null;
}

interface Props {
  patient: Patient;
}

export default function EditPatientModal({ patient }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Campos del formulario
  const [fullName, setFullName] = useState(patient.full_name ?? "");
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [docNumber, setDocNumber] = useState(patient.document_number ?? "");
  const [isPassport, setIsPassport] = useState(() => isPassportDocument(patient.document_number ?? ""));

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Resetear a valores actuales del paciente al abrir
    setFullName(patient.full_name ?? "");
    setPhone(patient.phone ?? "");
    setEmail(patient.email ?? "");
    setDocNumber(patient.document_number ?? "");
    setIsPassport(isPassportDocument(patient.document_number ?? ""));
    setToast(null);
    setOpen(true);
  }

  function closeModal(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (loading) return;
    setOpen(false);
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!fullName.trim()) {
      setToast({ type: "error", msg: "El nombre del paciente es obligatorio." });
      return;
    }

    if (docNumber.trim()) {
      const docErr = validateDocumento(docNumber, isPassport);
      if (docErr) {
        setToast({ type: "error", msg: docErr });
        return;
      }
    }

    setLoading(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: patient.id,
          full_name: fullName,
          phone,
          email,
          document_number: docNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");

      setToast({ type: "success", msg: "Datos actualizados correctamente." });
      router.refresh();

      // Cerrar el modal tras un breve momento de feedback
      setTimeout(() => {
        setOpen(false);
        setToast(null);
      }, 1200);
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "No se pudo guardar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Botón disparador */}
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-lilac-200 bg-white text-lilac-700 hover:bg-lilac-50 hover:border-lilac-400 transition-all shadow-sm"
        title="Editar datos del paciente"
      >
        <Pencil size={12} />
        Editar datos
      </button>

      {/* Overlay del modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-lilac-50">
              <div>
                <h2 className="text-base font-bold text-ink-900">Editar Datos del Paciente</h2>
                <p className="text-xs text-ink-500 mt-0.5">Actualiza la información de contacto</p>
              </div>
              <button
                onClick={closeModal}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-ink-400 hover:bg-lilac-50 hover:text-ink-700 transition disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* Formulario */}
            <div className="px-6 py-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User size={12} className="text-lilac-500" />
                    Nombre completo <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  placeholder="Nombre completo del paciente"
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>

              {/* Cédula */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-ink-700">
                    <span className="flex items-center gap-1.5">
                      <IdCard size={12} className="text-lilac-500" />
                      Documento de Identidad
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPassport}
                      onChange={(e) => {
                        setIsPassport(e.target.checked);
                        setDocNumber("");
                      }}
                      className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 h-3.5 w-3.5"
                    />
                    <span className="text-xs font-semibold text-ink-700">Pasaporte</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => {
                    const val = isPassport ? e.target.value.toUpperCase() : e.target.value.replace(/[^0-9]/g, "");
                    setDocNumber(val);
                  }}
                  disabled={loading}
                  placeholder={isPassport ? "Ej: PA987654" : "Ej: 1700000001"}
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Phone size={12} className="text-lilac-500" />
                    Teléfono
                  </span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: 0998762634"
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} className="text-lilac-500" />
                    Correo electrónico
                  </span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="Ej: paciente@email.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>

              {/* Toast de feedback */}
              {toast && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border animate-in fade-in duration-200 ${
                    toast.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {toast.type === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  {toast.msg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={closeModal}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-sm shadow-lilac-200 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save size={13} /> Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
