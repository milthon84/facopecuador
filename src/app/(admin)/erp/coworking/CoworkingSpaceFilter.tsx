"use client";

import { useRouter } from "next/navigation";
import { Filter } from "lucide-react";

interface Props {
  activeResource: string;
  targetDate: string;
  activeMonth: string;
  activeStatus: string;
  activeView: "day" | "month";
}

export default function CoworkingSpaceFilter({
  activeResource,
  targetDate,
  activeMonth,
  activeStatus,
  activeView,
}: Props) {
  const router = useRouter();

  function handleChange(newResource: string) {
    const params = new URLSearchParams();
    if (activeView === "day") {
      params.set("date", targetDate);
    } else {
      params.set("month", activeMonth);
    }
    params.set("view", activeView);
    if (newResource !== "all") {
      params.set("resource", newResource);
    }
    if (activeStatus !== "all") {
      params.set("status", activeStatus);
    }
    router.push(`/erp/coworking?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 bg-white border border-lilac-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
      <Filter size={13} className="text-lilac-600 shrink-0" />
      <span className="text-xs text-ink-500 font-medium whitespace-nowrap hidden sm:inline">
        Espacio:
      </span>
      <select
        value={activeResource}
        onChange={(e) => handleChange(e.target.value)}
        className="text-xs font-semibold text-ink-800 bg-transparent focus:outline-none cursor-pointer pr-1"
      >
        <option value="all">Todos los espacios</option>
        <option value="puesto_trabajo">Puesto Dental (Sillón)</option>
        <option value="clinica_completa">Clínica Completa</option>
        <option value="aula_pequena">Aula Pequeña</option>
        <option value="aula_grande">Aula Grande</option>
      </select>
    </div>
  );
}
