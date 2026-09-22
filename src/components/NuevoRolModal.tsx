"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Shield, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createRoleAction } from "@/app/(admin)/erp/roles/actions";

const COLOR_OPTIONS = [
  { value: "bg-lilac-100 text-lilac-800 border-lilac-300", label: "Morado" },
  { value: "bg-blue-50 text-blue-800 border-blue-200",       label: "Azul" },
  { value: "bg-green-50 text-green-800 border-green-300",    label: "Verde" },
  { value: "bg-amber-50 text-amber-800 border-amber-200",    label: "Ámbar" },
  { value: "bg-rose-50 text-rose-800 border-rose-200",       label: "Rosa" },
  { value: "bg-orange-50 text-orange-800 border-orange-200", label: "Naranja" },
  { value: "bg-teal-50 text-teal-800 border-teal-200",       label: "Teal" },
  { value: "bg-gray-100 text-gray-800 border-gray-200",      label: "Gris" },
];

export default function NuevoRolModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [description, setDescription] = useState("");

  function handleOpen() {
    setLabel("");
    setColor(COLOR_OPTIONS[0].value);
    setDescription("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setErrorMsg("El nombre visible del rol es requerido.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("label", label.trim());
    formData.append("color", color);
    formData.append("description", description.trim());

    try {
      await createRoleAction(formData);
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al crear el rol.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      >
        <Plus size={16} />
        <span>Crear Rol</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Crear Nuevo Rol"
        subtitle="Define un rol y luego personaliza sus permisos de acceso"
        icon={<Shield size={18} />}
        loading={loading}
        loadingText="Creando rol en el sistema..."
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-600 hover:bg-lilac-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <Save size={14} /> Guardar Rol
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Nombre visible <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ej: Odontólogo General, Auditor, Pasante..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Color de identificación
            </label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Descripción o funciones
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción del perfil de acceso..."
              className="w-full px-3.5 py-2 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition resize-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      </StandardModal>
    </>
  );
}
