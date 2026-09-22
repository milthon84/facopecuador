"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Tag, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateCategoryAction } from "@/app/(admin)/erp/categorias/actions";

interface Props {
  category: {
    id: string;
    name: string;
    prefix: string;
  };
}

export default function EditarCategoriaModal({ category }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState(category.name);
  const [prefix, setPrefix] = useState(category.prefix);

  function handleOpen() {
    setName(category.name);
    setPrefix(category.prefix);
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !prefix.trim()) {
      setErrorMsg("Completa todos los campos requeridos.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await updateCategoryAction({
        id: category.id,
        name: name.trim(),
        prefix: prefix.trim().toUpperCase(),
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo actualizar la categoría.");
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
        title="Modificar categoría"
      >
        <Pencil size={13} />
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Editar Categoría"
        subtitle="Actualiza los datos de clasificación del insumo"
        icon={<Tag size={18} />}
        loading={loading}
        loadingText="Actualizando categoría..."
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
              Nombre de la categoría <span className="text-red-500">*</span>
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

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Prefijo SKU (2-4 letras) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={4}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              className="w-28 px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition uppercase font-mono font-bold text-center"
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
