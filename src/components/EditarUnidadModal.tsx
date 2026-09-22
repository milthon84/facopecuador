"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Ruler, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateUnitAction } from "@/app/(admin)/erp/unidades/actions";

interface Props {
  unit: {
    id: string;
    name: string;
  };
}

export default function EditarUnidadModal({ unit }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(unit.name);

  function handleOpen() {
    setName(unit.name);
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Ingresa el nombre de la unidad.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await updateUnitAction({
        id: unit.id,
        name: name.trim(),
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo actualizar la unidad.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="p-1.5 text-lilac-700 hover:bg-lilac-100 rounded-lg transition"
        title="Modificar unidad"
      >
        <Pencil size={13} />
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Editar Unidad de Medida"
        subtitle="Actualiza la denominación de la unidad"
        icon={<Ruler size={18} />}
        loading={loading}
        loadingText="Actualizando unidad de medida..."
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
              <Save size={14} /> Guardar Cambios
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Nombre de la unidad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
              autoFocus
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
