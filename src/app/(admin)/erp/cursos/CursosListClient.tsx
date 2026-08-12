"use client";

import { useState } from "react";
import { 
  GraduationCap, Calendar, Users, DollarSign, ArrowRight, 
  ChevronDown, ChevronUp, CheckCircle2 
} from "lucide-react";
import Link from "next/link";
import CopyCourseButton from "@/components/CopyCourseButton";

interface CourseItem {
  id: string;
  name: string;
  description?: string | null;
  total_cost: number;
  max_students?: number | null;
  start_date: string;
  end_date: string;
  status: string;
  image_url?: string | null;
  curso_modulos?: { id: string; cost: number }[];
}

interface Props {
  cursos: CourseItem[];
  studentCountMap: Record<string, number>;
  canEdit: boolean;
}

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft:       { label: "Borrador", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  active:      { label: "Abierto", cls: "bg-green-100 text-green-700 border-green-200" },
  in_progress: { label: "En Ejecución", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  completed:   { label: "Finalizado", cls: "bg-lilac-100 text-lilac-700 border-lilac-200" },
  cancelled:   { label: "Cancelado", cls: "bg-red-100 text-red-700 border-red-200" },
};

const formatDateES = (d: string) => {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

export default function CursosListClient({ cursos, studentCountMap, canEdit }: Props) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Cursos Operativos (Borrador, Abierto, En Ejecución) ordenados por fecha de inicio descendente
  const mainCourses = cursos
    .filter((c) => c.status === "draft" || c.status === "active" || c.status === "in_progress")
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  // Cursos Concluidos (Finalizado, Cancelado) ordenados por fecha de inicio descendente
  const completedCourses = cursos
    .filter((c) => c.status === "completed" || c.status === "cancelled")
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  const renderCourseCard = (c: CourseItem) => {
    const studentCount = studentCountMap[c.id] || 0;
    const badge = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
    const modulesCount = c.curso_modulos?.length || 0;

    return (
      <div key={c.id} className="card bg-white border border-lilac-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
        {c.image_url && (
          <div className="h-36 w-full overflow-hidden border-b border-lilac-50">
            <img 
              src={c.image_url} 
              alt={c.name} 
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}
        <div className="p-5 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
            <span className="text-[10px] text-ink-400 font-semibold bg-lilac-50 px-2 py-0.5 rounded-full">
              {modulesCount} {modulesCount === 1 ? "módulo" : "módulos"}
            </span>
          </div>

          <div>
            <Link href={`/erp/cursos/${c.id}`} className="hover:underline">
              <h3 className="font-bold text-ink-900 leading-snug text-base line-clamp-1 hover:text-lilac-700 transition-colors">{c.name}</h3>
            </Link>
            {c.description && (
              <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>
            )}
          </div>

          <div className="pt-2 border-t border-lilac-50 grid grid-cols-2 gap-3 text-xs text-ink-600">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">Inicio</span>
              <div className="flex items-center gap-1.5 font-medium text-ink-850">
                <Calendar size={13} className="text-lilac-500 shrink-0" />
                <span className="truncate">{formatDateES(c.start_date)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">Alumnos</span>
              <div className="flex items-center gap-1.5 font-medium text-ink-850">
                <Users size={13} className="text-lilac-500 shrink-0" />
                <span>{studentCount} {studentCount === 1 ? "alumno" : "alumnos"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-lilac-50/20 border-t border-lilac-50/70 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-0.5 font-bold text-lilac-800 text-sm">
            <DollarSign size={14} className="text-lilac-600 shrink-0" />
            <span>{Number(c.total_cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {canEdit && (
              <CopyCourseButton courseId={c.id} courseName={c.name} variant="icon" />
            )}
            <Link
              href={`/erp/cursos/${c.id}`}
              className="inline-flex items-center justify-center gap-1.5 bg-lilac-700 hover:bg-lilac-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            >
              <span>Gestionar</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (cursos.length === 0) {
    return (
      <div className="card p-10 text-center text-sm text-ink-500 italic bg-white border border-lilac-100 shadow-sm rounded-3xl">
        No hay cursos registrados. ¡Comienza creando uno nuevo!
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sección 1: Cursos Activos / Operativos */}
      {mainCourses.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-lilac-100">
            <GraduationCap size={20} className="text-green-600" />
            <h2 className="text-base font-bold text-ink-950">Cursos Activos</h2>
            <span className="text-xs font-bold bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full ml-auto">
              {mainCourses.length}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {mainCourses.map(renderCourseCard)}
          </div>
        </section>
      )}

      {/* Sección 2: Cursos Concluidos (En la sección inferior) */}
      {completedCourses.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between bg-lilac-50/60 border border-lilac-100 p-4 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={20} className="text-lilac-600" />
              <div>
                <h2 className="text-sm font-bold text-ink-900">Cursos Concluidos / Finalizados</h2>
                <p className="text-xs text-ink-500 font-medium">Programas finalizados o archivados ({completedCourses.length})</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCompleted(!showCompleted)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-lilac-700 bg-white hover:bg-lilac-100 border border-lilac-200 px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
            >
              {showCompleted ? (
                <>
                  <span>Ocultar ({completedCourses.length})</span>
                  <ChevronUp size={15} />
                </>
              ) : (
                <>
                  <span>Mostrar ({completedCourses.length})</span>
                  <ChevronDown size={15} />
                </>
              )}
            </button>
          </div>

          {showCompleted && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 animate-in fade-in duration-200">
              {completedCourses.map(renderCourseCard)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
