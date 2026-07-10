"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, CalendarDays, DollarSign, GraduationCap } from "lucide-react";

interface Course {
  id: string;
  name: string;
  description: string | null;
  total_cost: number;
  start_date: string;
  end_date: string;
  image_url?: string | null;
}

interface Props {
  courses: Course[];
  whatsappPhone: string;
  onCourseChange?: (course: Course) => void;
}

export default function CursosCarousel({ courses, whatsappPhone, onCourseChange }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Notificar al componente padre de forma segura cuando cambia el curso activo
  useEffect(() => {
    if (courses.length > 0 && onCourseChange) {
      onCourseChange(courses[currentIndex]);
    }
  }, [currentIndex, courses, onCourseChange]);

  const next = useCallback(() => {
    if (courses.length <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % courses.length);
      setAnimating(false);
    }, 420);
  }, [courses.length, animating]);

  useEffect(() => {
    if (courses.length <= 1) return;
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, [next, courses.length]);

  if (courses.length === 0) return null;

  const activeCourse = courses[currentIndex];
  const nextCourse = courses[(currentIndex + 1) % courses.length];

  const waMessage = encodeURIComponent(
    `Hola FACOP Ecuador, estoy interesado en el curso: "${activeCourse.name}". ¿Podría darme más información?`
  );
  const waLink = `https://wa.me/${whatsappPhone}?text=${waMessage}`;

  return (
    <div
      className="relative w-full h-[420px] cursor-pointer select-none"
      onClick={next}
      title="Clic para ver el siguiente curso"
    >
      {/* ── TARJETA PEQUEÑA — curso siguiente — esquina inferior izquierda ── */}
      <div
        className={`absolute bottom-0 left-0 w-52 h-64 rounded-2xl overflow-hidden shadow-xl border border-slate-100 bg-white
          transition-all duration-500 ease-out
          ${animating
            ? "scale-105 -translate-x-3 translate-y-3 -rotate-3 opacity-0"
            : "scale-100 translate-x-0 translate-y-0 rotate-0 opacity-100"
          }
        `}
        style={{ zIndex: 10 }}
      >
        {nextCourse.image_url ? (
          <img src={nextCourse.image_url} alt={nextCourse.name} className="w-full h-32 object-cover" />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-gold-50 to-slate-100 flex items-center justify-center">
            <BookOpen size={28} className="text-slate-300" />
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <p className="text-[9px] text-gold-500 font-semibold uppercase tracking-wider">
            {new Date(nextCourse.start_date).toLocaleDateString("es-EC", { month: "short", year: "numeric" })}
          </p>
          <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
            {nextCourse.name}
          </h4>
          <p className="text-[10px] font-semibold text-gold-600">
            ${Number(nextCourse.total_cost).toFixed(0)}
          </p>
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL — curso actual — ocupa ~73% del ancho, desde la derecha ── */}
      <div
        className={`absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-slate-400/30 bg-white border border-slate-100/80
          transition-all duration-500 ease-out
          ${animating
            ? "translate-x-8 translate-y-4 opacity-0 scale-95"
            : "translate-x-0 translate-y-0 opacity-100 scale-100"
          }
        `}
        style={{ zIndex: 20, width: "73%", height: "100%" }}
      >
        {/* Imagen de banner */}
        {activeCourse.image_url ? (
          <div className="relative overflow-hidden" style={{ height: "56%" }}>
            <img
              src={activeCourse.image_url}
              alt={activeCourse.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            {/* Badge de precio sobre imagen */}
            <div className="absolute bottom-3 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <DollarSign size={11} className="text-gold-600" />
              <span className="text-xs font-bold text-slate-900">{Number(activeCourse.total_cost).toFixed(0)}</span>
            </div>
          </div>
        ) : (
          <div
            className="w-full bg-gradient-to-br from-slate-100 via-gold-50 to-slate-50 flex items-center justify-center"
            style={{ height: "56%" }}
          >
            <BookOpen size={52} className="text-slate-200" />
          </div>
        )}

        {/* Contenido */}
        <div className="p-6 space-y-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={11} className="text-gold-500" />
            <span className="text-[10px] text-gold-600 font-semibold uppercase tracking-widest">
              Inicio: {new Date(activeCourse.start_date).toLocaleDateString("es-EC", { dateStyle: "medium" })}
            </span>
          </div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
            {activeCourse.name}
          </h3>
          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 font-light">
            {activeCourse.description || "Programa académico de alto nivel con docentes especializados."}
          </p>
        </div>

        {/* Pie */}
        <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center">
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-600 hover:text-gold-800 transition-colors group"
          >
            Más información
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </a>

          {/* Botón inscribirse */}
          <Link
            href={`/inscripcion-curso/${activeCourse.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 text-gold-400 text-[11px] font-semibold hover:bg-slate-800 transition-all group shadow-sm"
          >
            <GraduationCap size={11} className="group-hover:scale-110 transition-transform" />
            Inscribirse
          </Link>
        </div>
      </div>
    </div>
  );
}
