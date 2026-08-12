"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen, Award, Users, Sparkles } from "lucide-react";
import CursosCarousel from "./CursosCarousel";

interface Course {
  id: string;
  name: string;
  description: string | null;
  total_cost: number;
  start_date: string;
  end_date: string;
  image_url?: string | null;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  image_url: string | null;
  created_at: string;
  category?: string;
}

interface Props {
  courses: Course[];
  posts?: Post[];
  whatsappPhone: string;
  whatsappLink: string;
}

export default function CursosSection({ courses, posts = [], whatsappPhone }: Props) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    courses.length > 0 ? courses[0].id : ""
  );

  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">

      {/* LADO IZQUIERDO: 6 columnas — Carrusel de Afiches Superpuesto */}
      <div className="lg:col-span-6 w-full">
        {courses.length === 0 && posts.length === 0 ? (
          <div className="relative w-full h-[520px] sm:h-[560px] flex items-center justify-center bg-slate-50/80 rounded-3xl border border-purple-200">
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <BookOpen size={36} className="text-purple-300" />
              <p className="text-xs text-slate-500 font-light max-w-[180px] leading-relaxed">
                Próximos cursos disponibles muy pronto.
              </p>
            </div>
          </div>
        ) : (
          <CursosCarousel
            courses={courses}
            posts={posts}
            whatsappPhone={whatsappPhone}
            onCourseChange={(course) => setActiveCourseId(course.id)}
          />
        )}
      </div>

      {/* LADO DERECHO: 6 columnas — Título, Descripción, Métricas y Botón */}
      <div className="lg:col-span-6 space-y-6">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.12] tracking-tight">
          Cursos y Diplomados
        </h2>
        
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal max-w-lg">
          Capacítate con los mejores especialistas internacionales y técnicas de vanguardia en odontología. Cupos limitados para una formación práctica de máxima excelencia académica.
        </p>

        {/* METRICAS / BENEFICIOS EJECUTIVOS — LLENAN EL ESPACIO DE FORMA ELEGANTE */}
        <div className="grid grid-cols-3 gap-3 pt-1 border-y border-purple-200/60 py-4 max-w-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
              <Award size={14} className="text-gold-500 flex-shrink-0" />
              <span>Aval Oficial</span>
            </div>
            <p className="text-[11px] text-slate-500 font-light leading-snug">Certificación universitaria</p>
          </div>

          <div className="space-y-1 border-l border-purple-200/60 pl-3">
            <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
              <Users size={14} className="text-purple-600 flex-shrink-0" />
              <span>Especialistas</span>
            </div>
            <p className="text-[11px] text-slate-500 font-light leading-snug">Docentes clínicos líderes</p>
          </div>

          <div className="space-y-1 border-l border-purple-200/60 pl-3">
            <div className="flex items-center gap-1.5 text-purple-950 font-bold text-xs">
              <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
              <span>Práctica 100%</span>
            </div>
            <p className="text-[11px] text-slate-500 font-light leading-snug">Entrenamiento real</p>
          </div>
        </div>

        {/* ACCIÓN Y RESERVA */}
        {activeCourse && (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href={`/inscripcion-curso/${activeCourse.id}`}
              className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#3B154C] via-[#4A1C5F] to-[#2E103C] hover:from-[#2E103C] hover:to-[#3E1650] text-white text-xs sm:text-sm font-semibold shadow-xl shadow-purple-950/20 transition-all duration-200 active:scale-[0.98] group"
            >
              <GraduationCap size={17} className="group-hover:scale-110 transition-transform text-gold-400" />
              <span>Inscríbete ahora</span>
            </Link>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cupos disponibles</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}




