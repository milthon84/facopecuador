"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateDocumento, isPassportDocument } from "@/lib/validators";
import {
  Pencil,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  Mail,
  IdCard,
} from "lucide-react";
import StandardModal from "@/components/StandardModal";

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
  const [isPassport, setIsPassport] = useState(() =>
    isPassportDocument(patient.document_number ?? "")
  );

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFullName(patient.full_name ?? "");
    setPhone(patient.phone ?? "");
    setEmail(patient.email ?? "");
    setDocNumber(patient.document_number ?? "");
    setIsPassport(isPassportDocument(patient.document_number ?? ""));
    setToast(null);
    setOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

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

      setTimeout(() => {
        setOpen(false);
        setToast(null);
      }, 900);
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "No se pudo guardar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-lilac-200 bg-white text-lilac-700 hover:bg-lilac-50 hover:border-lilac-400 transition-all shadow-sm cursor-pointer"
        title="Editar datos del paciente"
      >
        <Pencil size={12} />
        <span>Editar datos</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={closeModal}
        title="Editar Datos del Paciente"
        subtitle="Actualiza la información de contacto y documento"
        icon={<User size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4">
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
              required
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition disabled:bg-ink-50 disabled:opacity-60"
            />
          </div>

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
                  disabled={loading}
                  className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 h-3.5 w-3.5"
                />
                <span className="text-xs font-semibold text-ink-700">Pasaporte</span>
              </label>
            </div>
            <input
              type="text"
              value={docNumber}
              onChange={(e) => {
                const val = isPassport
                  ? e.target.value.toUpperCase()
                  : e.target.value.replace(/[^0-9]/g, "");
                setDocNumber(val);
              }}
              disabled={loading}
              placeholder={isPassport ? "Ej: PA987654" : "Ej: 1700000001"}
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition disabled:bg-ink-50 disabled:opacity-60"
            />
          </div>

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
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition disabled:bg-ink-50 disabled:opacity-60"
            />
          </div>

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
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-400 bg-white transition disabled:bg-ink-50 disabled:opacity-60"
            />
          </div>

          {toast && (
            <div
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border ${
                toast.type === "success"
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : (
                <AlertCircle size={14} className="shrink-0" />
              )}
              <span>{toast.msg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition disabled:opacity-40 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-sm shadow-lilac-200 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
