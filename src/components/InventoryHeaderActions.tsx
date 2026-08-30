"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import InventoryImportExport from "./InventoryImportExport";
import ModalNuevoProductItem from "./ModalNuevoProductItem";

type CategoryOption = { name: string; prefix: string };

export default function InventoryHeaderActions({
  canEditProduct,
  categories,
  units,
}: {
  canEditProduct: boolean;
  categories: CategoryOption[];
  units: string[];
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InventoryImportExport canImport={canEditProduct} />
        {canEditProduct && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs sm:text-sm bg-lilac-600 hover:bg-lilac-700 text-white px-3.5 py-1.5 rounded-xl transition-colors font-semibold shadow-sm shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            Nuevo
          </button>
        )}
      </div>

      <ModalNuevoProductItem
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        units={units}
      />
    </>
  );
}
