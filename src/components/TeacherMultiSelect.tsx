"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Search, UserCheck } from "lucide-react";

interface TeacherOption {
  id: string;
  full_name: string;
  specialty?: string | null;
}

interface Props {
  teachers: TeacherOption[];
  initialSelectedIds?: string[];
  name?: string;
  onChange?: (selectedIds: string[]) => void;
  placeholder?: string;
}

export default function TeacherMultiSelect({
  teachers,
  initialSelectedIds = [],
  name = "teacherIds",
  onChange,
  placeholder = "Seleccionar profesor(es)...",
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync state if initialSelectedIds changes externally
  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleSelect = (id: string) => {
    let updated: string[];
    if (selectedIds.includes(id)) {
      updated = selectedIds.filter((item) => item !== id);
    } else {
      updated = [...selectedIds, id];
    }
    setSelectedIds(updated);
    if (onChange) onChange(updated);
  };

  const removeTeacher = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = selectedIds.filter((item) => item !== id);
    setSelectedIds(updated);
    if (onChange) onChange(updated);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.specialty && t.specialty.toLowerCase().includes(search.toLowerCase()))
  );

  const selectedTeachers = teachers.filter((t) => selectedIds.includes(t.id));

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden inputs para compatibilidad nativa con FormData en Server Actions */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {/* Combobox Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2.5 bg-white border border-lilac-200 hover:border-lilac-400 rounded-xl text-xs text-left shadow-2xs transition focus:outline-none focus:ring-2 focus:ring-lilac-300"
      >
        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden pr-2">
          {selectedTeachers.length === 0 ? (
            <span className="text-ink-400 italic flex items-center gap-1.5">
              <UserCheck size={14} className="text-lilac-500" />
              {placeholder}
            </span>
          ) : (
            selectedTeachers.map((t) => (
              <span
                key={t.id}
                className="bg-lilac-100 text-lilac-900 border border-lilac-200 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 text-[11px]"
              >
                {t.full_name}
                <X
                  size={12}
                  className="hover:text-red-600 transition cursor-pointer"
                  onClick={(e) => removeTeacher(t.id, e)}
                />
              </span>
            ))
          )}
        </div>

        <ChevronDown
          size={15}
          className={`text-ink-400 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-lilac-600" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-lilac-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          
          {/* Buscador interno */}
          {teachers.length > 4 && (
            <div className="p-2 border-b border-lilac-100 bg-lilac-50/40 relative">
              <Search size={13} className="absolute left-4 top-3.5 text-ink-400" />
              <input
                type="text"
                placeholder="Buscar profesor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-white border border-lilac-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-lilac-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Opciones */}
          <div className="max-h-48 overflow-y-auto divide-y divide-lilac-50 p-1">
            {filteredTeachers.length === 0 ? (
              <div className="p-3 text-center text-xs text-ink-400 italic">
                No se encontraron profesores.
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const isSelected = selectedIds.includes(t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => toggleSelect(t.id)}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-lilac-50 font-bold text-lilac-950"
                        : "hover:bg-lilac-50/50 text-ink-800 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-lilac-600 border-lilac-600 text-white"
                            : "border-lilac-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                      <span>{t.full_name}</span>
                    </div>

                    {t.specialty && (
                      <span className="text-[10px] text-ink-500 bg-white px-1.5 py-0.5 rounded border border-lilac-100 font-normal">
                        {t.specialty}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer desplegable */}
          <div className="p-2 bg-lilac-50/40 border-t border-lilac-100 flex items-center justify-between text-[11px] text-ink-500">
            <span>{selectedIds.length} seleccionado(s)</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-bold text-lilac-700 hover:underline"
            >
              Listo
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
