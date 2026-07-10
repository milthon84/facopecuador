"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useCallback } from "react";

interface InventoryFiltersProps {
  q: string;
  category: string;
  uniqueCategories: string[];
}

export default function InventoryFilters({
  q,
  category,
  uniqueCategories,
}: InventoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) {
        params.set("category", e.target.value);
      } else {
        params.delete("category");
      }
      router.push(`/erp/inventario?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <form className="flex flex-col sm:flex-row gap-2 mb-4" method="get" action="/erp/inventario">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={18} />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o SKU..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-lilac-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 transition-all shadow-sm"
        />
      </div>
      <select
        name="category"
        value={category}
        className="bg-white border border-lilac-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 transition-all shadow-sm"
        onChange={handleCategoryChange}
      >
        <option value="">Todas las Categorías</option>
        {uniqueCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="bg-lilac-600 hover:bg-lilac-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
      >
        Buscar
      </button>
    </form>
  );
}
