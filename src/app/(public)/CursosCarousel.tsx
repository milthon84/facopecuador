"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { BookOpen, ArrowRight, CalendarDays, GraduationCap } from "lucide-react";

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

type CarouselItem =
  | { kind: "course"; data: Course }
  | { kind: "post"; data: Post };

interface Props {
  courses: Course[];
  posts?: Post[];
  whatsappPhone: string;
  onCourseChange?: (course: Course) => void;
}

export default function CursosCarousel({ courses, posts = [], whatsappPhone, onCourseChange }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Cursos reales primero, artículos con destino "Cursos" a continuación
  const items: CarouselItem[] = useMemo(
    () => [
      ...courses.map((c) => ({ kind: "course" as const, data: c })),
      ...posts.map((p) => ({ kind: "post" as const, data: p })),
    ],
    [courses, posts]
  );

  // Notificar al componente padre de forma segura cuando el ítem activo es un curso real
  useEffect(() => {
    const active = items[currentIndex];
    if (active?.kind === "course" && onCourseChange) {
      onCourseChange(active.data);
    }
  }, [currentIndex, items, onCourseChange]);

  const next = useCallback(() => {
    if (items.length <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
      setAnimating(false);
    }, 420);
  }, [items.length, animating]);

  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, [next, items.length]);

  if (items.length === 0) return null;

  const activeItem = items[currentIndex];
  const nextItem = items[(currentIndex + 1) % items.length];

  const nextDate = nextItem.kind === "course" ? nextItem.data.start_date : nextItem.data.created_at;
  const nextTitle = nextItem.kind === "course" ? nextItem.data.name : nextItem.data.title;
  const nextImage = nextItem.data.image_url;

  const activeDate = activeItem.kind === "course" ? activeItem.data.start_date : activeItem.data.created_at;
  const activeTitle = activeItem.kind === "course" ? activeItem.data.name : activeItem.data.title;
  const activeDescription = activeItem.kind === "course" ? activeItem.data.description : activeItem.data.content;
  const activeImage = activeItem.data.image_url;

  const waMessage = encodeURIComponent(
    `Hola FACOP Ecuador, estoy interesado en el curso: "${activeTitle}". ¿Podría darme más información?`
  );
  const waLink = `https://wa.me/${whatsappPhone}?text=${waMessage}`;

  return (
    <div
      className="relative w-full h-[580px] cursor-pointer select-none"
      onClick={next}
      title="Clic para ver el siguiente elemento"
    >
      {/* ── TARJETA PEQUEÑA — siguiente elemento — esquina inferior izquierda ── */}
      <div
        className={`absolute bottom-0 left-0 w-60 h-80 rounded-2xl overflow-hidden shadow-xl border border-slate-100 bg-white
          transition-all duration-500 ease-out
          ${animating
            ? "scale-105 -translate-x-3 translate-y-3 -rotate-3 opacity-0"
            : "scale-100 translate-x-0 translate-y-0 rotate-0 opacity-100"
          }
        `}
        style={{ zIndex: 10 }}
      >
        {nextImage ? (
          <img src={nextImage} alt={nextTitle} className="w-full h-44 object-fill" />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-gold-50 to-slate-100 flex items-center justify-center">
            <BookOpen size={28} className="text-slate-300" />
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <p className="text-[9px] text-gold-500 font-semibold uppercase tracking-wider">
            {new Date(nextDate).toLocaleDateString("es-EC", { month: "short", year: "numeric" })}
          </p>
          <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
            {nextTitle}
          </h4>
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL — elemento actual — ocupa ~73% del ancho, desde la derecha ── */}
      <div
        className={`absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-slate-400/30 bg-slate-900 border border-slate-800
          transition-all duration-500 ease-out
          ${animating
            ? "translate-x-8 translate-y-4 opacity-0 scale-95"
            : "translate-x-0 translate-y-0 opacity-100 scale-100"
          }
        `}
        style={{ zIndex: 20, width: "73%", height: "100%" }}
      >
        {/* Imagen de fondo que ocupa todo el alto */}
        {activeImage ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={activeImage}
              alt={activeTitle}
              className="absolute inset-0 w-full h-full object-fill"
            />
            {/* Gradiente overlay que sube para legibilidad del texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
            <BookOpen size={52} className="text-slate-700 opacity-40" />
          </div>
        )}

        {/* Contenido overlay en la parte inferior */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pt-16 z-10 space-y-3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-gold-400">
              <CalendarDays size={12} />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {activeItem.kind === "course" ? "Inicio: " : ""}
                {new Date(activeDate).toLocaleDateString("es-EC", { dateStyle: "medium" })}
              </span>
            </div>
            <h3 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2 drop-shadow-sm">
              {activeTitle}
            </h3>
            <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2 font-light">
              {activeDescription || "Programa académico de alto nivel con docentes especializados."}
            </p>
          </div>

          {/* Pie / Acciones */}
          {activeItem.kind === "course" ? (
            <div className="flex justify-between items-center pt-1.5 border-t border-white/10">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
              >
                Más información
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </a>

              {/* Botón inscribirse */}
              <Link
                href={`/inscripcion-curso/${activeItem.data.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-600 text-white text-[11px] font-semibold hover:bg-gold-500 transition-all group shadow-md"
              >
                <GraduationCap size={11} className="group-hover:scale-110 transition-transform" />
                Inscribirse
              </Link>
            </div>
          ) : (
            <div className="flex items-center pt-1.5 border-t border-white/10">
              <Link
                href={`/noticias/${activeItem.data.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
              >
                Leer artículo
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
