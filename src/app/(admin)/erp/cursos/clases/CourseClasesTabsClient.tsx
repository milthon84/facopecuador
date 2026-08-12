"use client";

import { useState } from "react";
import { Calendar, Megaphone, GraduationCap, BookOpen, ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

interface Props {
  courseId: string;
  selectedCourse: any;
  enrolledCount: number;
  activeTabDefault: string;
  clasesTabContent: React.ReactNode;
  avisosTabContent: React.ReactNode;
}

export default function CourseClasesTabsClient({
  courseId,
  selectedCourse,
  enrolledCount,
  activeTabDefault,
  clasesTabContent,
  avisosTabContent,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(activeTabDefault);

  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-4">
      {/* ENCABEZADO COMPACTO DE CURSO + PESTAÑAS */}
      <div className="bg-white border border-lilac-200 shadow-2xs rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedCourse.image_url ? (
              <img
                src={selectedCourse.image_url}
                alt={selectedCourse.name}
                className="w-12 h-12 rounded-xl object-cover border border-lilac-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-lilac-50 border border-lilac-200 flex items-center justify-center text-lilac-700 font-bold shrink-0">
                <GraduationCap size={22} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-ink-950 leading-tight">{selectedCourse.name}</h1>
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  selectedCourse.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"
                }`}>
                  {selectedCourse.status === "in_progress" ? "En Ejecución" : "Abierto"}
                </span>
                <span className="text-[10px] font-bold text-ink-500 bg-lilac-50 px-2 py-0.5 rounded-md border border-lilac-100 inline-flex items-center gap-1">
                  <Users size={11} /> {enrolledCount} Alumnos
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Del {new Date(selectedCourse.start_date + "T12:00:00").toLocaleDateString("es-EC")} al {new Date(selectedCourse.end_date + "T12:00:00").toLocaleDateString("es-EC")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/erp/cursos/${selectedCourse.id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-ink-700 bg-white border border-lilac-200 px-3 py-1.5 rounded-xl hover:bg-lilac-50 transition shadow-2xs"
            >
              <span>Detalle</span>
              <BookOpen size={13} />
            </Link>
            <Link
              href="/erp/cursos/clases"
              className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 bg-lilac-50 border border-lilac-200 px-3 py-1.5 rounded-xl hover:bg-lilac-100 transition shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Cambiar Curso</span>
            </Link>
          </div>
        </div>

        {/* PESTAÑAS DE NAVEGACIÓN INSTANTÁNEAS DE ALTA VELOCIDAD (0ms DELAY) */}
        <div className="flex border-t border-lilac-100 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("clases")}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === "clases"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-lilac-50/60"
            }`}
          >
            <Calendar size={14} />
            <span>Cronograma y Asistencia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("avisos")}
            className={`flex items-center gap-1.5 px-4 py-2 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === "avisos"
                ? "bg-lilac-600 text-white shadow-2xs"
                : "text-ink-600 hover:text-ink-900 hover:bg-lilac-50/60"
            }`}
          >
            <Megaphone size={14} />
            <span>Avisos y Comunicados</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑAS NAVEGABLE INSTANTÁNEAMENTE EN MEMORIA DEL CLIENTE */}
      <div className={activeTab === "clases" ? "block space-y-3" : "hidden"}>
        {clasesTabContent}
      </div>

      <div className={activeTab === "avisos" ? "block space-y-4" : "hidden"}>
        {avisosTabContent}
      </div>
    </div>
  );
}
