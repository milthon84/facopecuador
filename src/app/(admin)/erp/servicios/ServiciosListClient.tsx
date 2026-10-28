"use client";

import { useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import EditServiceModal from "@/components/EditServiceModal";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { toggleServiceAction, deleteServiceAction } from "./actions";

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number;
  iva_code: string;
  category: string;
  active: boolean;
};

interface Props {
  grouped: Record<string, ServiceItem[]>;
  existingCategories: string[];
  cashDiscountPercent: number;
  canEdit: boolean;
}

export default function ServiciosListClient({
  grouped,
  existingCategories,
  cashDiscountPercent,
  canEdit,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const categories = Object.keys(grouped);
  const totalServices = Object.values(grouped).reduce((acc, items) => acc + items.length, 0);

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    categories.forEach((cat) => {
      all[cat] = true;
    });
    setCollapsed(all);
  };

  const expandAll = () => {
    setCollapsed({});
  };

  const allCollapsed = categories.length > 0 && categories.every((cat) => collapsed[cat]);

  return (
    <div className="space-y-4">
      {/* Barra de control superior para colapsar / expandir */}
      <div className="flex items-center justify-between text-xs px-1 text-ink-500">
        <span>
          <strong>{categories.length}</strong> {categories.length === 1 ? "categoría" : "categorías"} •{" "}
          <strong>{totalServices}</strong> {totalServices === 1 ? "servicio disponible" : "servicios disponibles"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-lilac-700 hover:text-lilac-900 font-semibold hover:underline cursor-pointer"
          >
            Expandir todos
          </button>
          <span className="text-ink-300">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-ink-600 hover:text-ink-900 font-semibold hover:underline cursor-pointer"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* Lista de categorías */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => {
          const isCollapsed = !!collapsed[category];

          return (
            <div
              key={category}
              className="bg-white border border-lilac-100 rounded-3xl shadow-sm overflow-hidden transition-all"
            >
              {/* Cabecera Colapsable de la Categoría */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className={`w-full px-6 py-3.5 flex items-center justify-between text-left transition-colors cursor-pointer select-none ${
                  isCollapsed
                    ? "bg-lilac-50/20 hover:bg-lilac-50/50"
                    : "bg-lilac-50/50 hover:bg-lilac-50/70 border-b border-lilac-100"
                }`}
                title={isCollapsed ? "Clic para expandir categoría" : "Clic para colapsar categoría"}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg bg-white border border-lilac-200/80 text-lilac-700 flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 ${
                      isCollapsed ? "-rotate-90 text-ink-400" : "rotate-0 text-lilac-700"
                    }`}
                  >
                    <ChevronDown size={14} />
                  </div>
                  <span className="text-xs font-bold text-ink-900 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Tag size={12} className="text-lilac-600 shrink-0" /> {category}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-lilac-700 bg-white border border-lilac-200/80 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                    {items.length} {items.length === 1 ? "servicio" : "servicios"}
                  </span>
                </div>
              </button>

              {/* Lista de Servicios dentro de la Categoría (Colapsable) */}
              {!isCollapsed && (
                <div className="divide-y divide-lilac-50 animate-in fade-in duration-150">
                  {items.map((s) => (
                    <div
                      key={s.id}
                      className={`px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        s.active ? "hover:bg-lilac-50/20" : "bg-gray-50/80 opacity-60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-ink-900 truncate">{s.name}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${
                              s.iva_code === "4"
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            IVA {s.iva_code === "4" ? "15%" : "0%"}
                          </span>
                        </div>
                        {s.description && (
                          <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{s.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                        <div className="text-right">
                          <p className="text-[11px] text-ink-400 font-mono" title="PVP Oficial (Tarjeta)">
                            PVP: ${Number(s.price).toFixed(2)}
                          </p>
                          {cashDiscountPercent > 0 && (
                            <p
                              className="text-xs font-bold text-green-700 font-mono"
                              title={`Efectivo (${cashDiscountPercent}% Desc)`}
                            >
                              Efectivo: ${(Number(s.price) * (1 - cashDiscountPercent / 100)).toFixed(2)}
                            </p>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <EditServiceModal
                              service={{
                                id: s.id,
                                name: s.name,
                                price: s.price,
                                iva_code: s.iva_code,
                                category: s.category,
                              }}
                              existingCategories={existingCategories}
                              cashDiscountPercent={cashDiscountPercent}
                            />

                            <form action={toggleServiceAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="active" value={String(s.active)} />
                              <button
                                type="submit"
                                title={s.active ? "Desactivar" : "Activar"}
                                className={`p-1.5 rounded-lg transition text-sm font-bold cursor-pointer ${
                                  s.active ? "text-amber-500 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"
                                }`}
                              >
                                {s.active ? "●" : "○"}
                              </button>
                            </form>

                            <ConfirmDeleteButton
                              action={deleteServiceAction}
                              idName="id"
                              idValue={s.id}
                              confirmMessage={`¿Estás seguro de eliminar el servicio "${s.name}"?`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
