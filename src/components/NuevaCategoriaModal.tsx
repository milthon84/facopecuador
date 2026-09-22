"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tag, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { addCategoryAction } from "@/app/(admin)/erp/categorias/actions";

export default function NuevaCategoriaModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");

  function handleOpen() {
    setName("");
    setPrefix("");
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
      await addCategoryAction({
        name: name.trim(),
        prefix: prefix.trim().toUpperCase(),
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "No se pudo registrar la categoría.");
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
        <span>Nueva Categoría</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Nueva Categoría de Insumos"
        subtitle="Clasificación para el control de inventario y stock"
        icon={<Tag size={18} />}
        loading={loading}
        loadingText="Registrando categoría y actualizando..."
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
              <Save size={14} /> Guardar Categoría
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
              placeholder="Ej: Descartables, Biomateriales, Anestésicos..."
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
              placeholder="Ej: BIO, DES, ANE"
              className="w-28 px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition uppercase font-mono font-bold text-center"
            />
            <p className="text-[11px] text-ink-400 mt-1.5">
              Se utiliza para la generación automática de códigos de inventario (ej: <strong>BIO</strong>-001).
            </p>
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
