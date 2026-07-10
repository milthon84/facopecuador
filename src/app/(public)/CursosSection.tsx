"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen } from "lucide-react";
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
  // activeCourseId rastrea qué curso está activo en el carrusel
  const [activeCourseId, setActiveCourseId] = useState<string>(
    courses.length > 0 ? courses[0].id : ""
  );

  // El curso activo siempre se resuelve desde la lista (nunca null si hay cursos)
  const activeCourse = courses.find((c) => c.id === activeCourseId) ?? courses[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">

      {/* LADO IZQUIERDO: 6 columnas — Carrusel de cursos 3D */}
      <div className="lg:col-span-6 w-full">
        {courses.length === 0 && posts.length === 0 ? (
          <div className="relative w-full h-[580px] flex items-center justify-center">
            <div className="absolute right-4 bottom-4 w-52 h-64 bg-slate-200/60 rounded-3xl rotate-3" />
            <div className="w-[73%] h-full bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-3 p-8 text-center">
              <BookOpen size={36} className="text-slate-200" />
              <p className="text-xs text-slate-400 font-light max-w-[180px] leading-relaxed">
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

      {/* LADO DERECHO: 6 columnas — Título, descripción y botón */}
      <div className="lg:col-span-6 space-y-4">
        <h2 className="text-2xl sm:text-[2rem] lg:text-[2.4rem] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
          Cursos y Diplomados
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light max-w-xs">
          Capacítate con los mejores especialistas y técnicas del mercado odontológico global. Cupos limitados.
        </p>

        {/* Botón de inscripción — solo si hay al menos un curso activo */}
        {activeCourse && (
          <div className="pt-2 flex flex-col items-start gap-2">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              Inscripciones abiertas
            </span>
            <Link
              href={`/inscripcion-curso/${activeCourse.id}`}
              className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-gold-500 hover:text-gold-400 transition-all text-xs font-semibold shadow-lg group"
            >
              <GraduationCap size={15} className="text-gold-500 group-hover:scale-105 transition-transform" />
              <span>Inscríbete ya</span>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
