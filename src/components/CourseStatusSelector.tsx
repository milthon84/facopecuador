"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { updateCourseStatusAction } from "@/app/(admin)/erp/cursos/actions";

interface Props {
  courseId: string;
  currentStatus: string;
  canEdit: boolean;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador (No visible en web)" },
  { value: "active", label: "Abierto (Inscripciones)" },
  { value: "in_progress", label: "En Ejecución (En curso)" },
  { value: "completed", label: "Finalizado" },
  { value: "cancelled", label: "Cancelado" },
];

export default function CourseStatusSelector({ courseId, currentStatus, canEdit }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    setStatus(newStatus);
    setLoading(true);
    try {
      await updateCourseStatusAction(courseId, newStatus);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Error al actualizar el estado");
      setStatus(currentStatus);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadgeStyle = (st: string) => {
    switch (st) {
      case "active": return "bg-green-50 text-green-700 border-green-200";
      case "in_progress": return "bg-blue-50 text-blue-700 border-blue-200";
      case "draft": return "bg-gray-50 text-gray-700 border-gray-200";
      case "completed": return "bg-lilac-50 text-lilac-700 border-lilac-200";
      case "cancelled": return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-600 border-gray-200";
    }
  };

  if (!canEdit) {
    const currentOpt = STATUS_OPTIONS.find((s) => s.value === currentStatus);
    return (
      <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${getStatusBadgeStyle(currentStatus)}`}>
        {currentOpt?.label || currentStatus}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-ink-600">Estado:</span>
      <div className="relative inline-flex items-center">
        <select
          value={status}
          onChange={handleChange}
          disabled={loading}
          className={`appearance-none text-xs font-bold pl-3 pr-7 py-1.5 rounded-xl border outline-none cursor-pointer transition shadow-2xs focus:ring-2 focus:ring-lilac-400 disabled:opacity-50 ${getStatusBadgeStyle(status)}`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white text-ink-900 font-normal">
              {opt.label}
            </option>
          ))}
        </select>
        {loading ? (
          <Loader2 size={13} className="animate-spin text-ink-600 absolute right-2.5 pointer-events-none" />
        ) : (
          <div className="w-1.5 h-1.5 border-r-2 border-b-2 border-current rotate-45 absolute right-3 pointer-events-none" />
        )}
      </div>
    </div>
  );
}
