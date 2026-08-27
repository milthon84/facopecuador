"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ArrowRight, CalendarDays, GraduationCap, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

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
  slug?: string;
  content: string;
  image_url: string | null;
  video_url?: string | null;
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

const DEFAULT_CURSO_ITEM: CarouselItem = {
  kind: "course",
  data: {
    id: "default-course-1",
    name: "Formación de Posgrado Odontológico Avanzado",
    description: "Diplomados y capacitaciones prácticas con especialistas clínicos de nivel internacional en Quito.",
    total_cost: 0,
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    image_url: null,
  },
};

export default function CursosCarousel({ courses = [], posts = [], whatsappPhone, onCourseChange }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const rawItems: CarouselItem[] = useMemo(
    () => [
      ...courses.map((c) => ({ kind: "course" as const, data: c })),
      ...posts.map((p) => ({ kind: "post" as const, data: p })),
    ],
    [courses, posts]
  );

  const items: CarouselItem[] = useMemo(() => {
    if (rawItems.length >= 2) return rawItems;
    if (rawItems.length === 1) return [...rawItems, DEFAULT_CURSO_ITEM];
    return [DEFAULT_CURSO_ITEM, {
      kind: "course",
      data: {
        id: "default-course-2",
        name: "Capacitación Práctica Continua FACOP",
        description: "Talleres presenciales intensivos y certificación universitaria con docentes expertos.",
        total_cost: 0,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        image_url: null,
      }
    }];
  }, [rawItems]);

  const totalItems = items.length;

  useEffect(() => {
    const active = items[currentIndex];
    if (active?.kind === "course" && onCourseChange && active.data.id !== "default-course-1" && active.data.id !== "default-course-2") {
      onCourseChange(active.data);
    }
  }, [currentIndex, items, onCourseChange]);

  const next = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (totalItems <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % totalItems);
      setAnimating(false);
    }, 350);
  }, [totalItems, animating]);

  const prev = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (totalItems <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + totalItems) % totalItems);
      setAnimating(false);
    }, 350);
  }, [totalItems, animating]);

  const activeItem = items[currentIndex];
  const nextItem = items[(currentIndex + 1) % totalItems];

  const activeVideo = activeItem?.kind === "post" ? activeItem.data.video_url : null;
  const activeImage = activeItem?.data.image_url;

  // Control de avance automático:
  // - Si el elemento activo contiene VIDEO: NO se usa temporizador fijo. Avanza al finalizar el video (onEnded).
  // - Si es IMAGEN o texto: Avanza de forma regular cada 6 segundos.
  useEffect(() => {
    if (totalItems <= 1) return;

    if (activeVideo) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }

      const safetyTimer = setTimeout(() => {
        next();
      }, 25000);

      return () => clearTimeout(safetyTimer);
    }

    const interval = setInterval(() => {
      next();
    }, 6000);

    return () => clearInterval(interval);
  }, [next, totalItems, activeVideo, currentIndex]);

  const activeIsCourse = activeItem.kind === "course";
  const activeTitle = activeIsCourse ? activeItem.data.name : activeItem.data.title;
  const activeDate = activeIsCourse ? activeItem.data.start_date : activeItem.data.created_at;
  const activeDesc = activeIsCourse ? activeItem.data.description : activeItem.data.content;

  const nextIsCourse = nextItem.kind === "course";
  const nextTitle = nextIsCourse ? nextItem.data.name : nextItem.data.title;
  const nextDate = nextIsCourse ? nextItem.data.start_date : nextItem.data.created_at;
  const nextImage = nextItem.data.image_url;
  const nextVideo = nextItem.kind === "post" ? nextItem.data.video_url : null;

  const waMessage = encodeURIComponent(
    `Hola FACOP Ecuador, estoy interesado en: "${activeTitle}". ¿Podría darme información?`
  );
  const waLink = `https://wa.me/${whatsappPhone}?text=${waMessage}`;

  // Navegación al hacer clic sobre la tarjeta/imagen principal
  const handleMainCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIsCourse) {
      if (activeItem.data.id.startsWith("default-course")) {
        window.open(waLink, "_blank");
      } else {
        router.push(`/inscripcion-curso/${activeItem.data.id}`);
      }
    } else if (activeItem.data.slug) {
      router.push(`/noticias/${activeItem.data.slug}`);
    } else {
      window.open(waLink, "_blank");
    }
  };

  return (
    <div className="relative w-full h-[520px] sm:h-[580px] select-none group/carousel">
      {/* ── CONTROLES MANUALES DE NAVEGACIÓN (BOTONES PREV / NEXT) ── */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <button
          onClick={prev}
          aria-label="Afiche anterior"
          className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={next}
          aria-label="Siguiente afiche"
          className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── INDICADORES DE PUNTOS (DOTS) ── */}
      <div className="absolute top-5 left-6 z-30 flex items-center gap-1.5 pointer-events-auto">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              if (idx !== currentIndex && !animating) {
                setAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(idx);
                  setAnimating(false);
                }, 300);
              }
            }}
            aria-label={`Ir al afiche ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-6 bg-gold-400"
                : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* ── TARJETA SECUNDARIA SUPERPUESTA — Esquina inferior izquierda (Precarga activa, clic avanza) ── */}
      {totalItems > 1 && (
        <div
          onClick={next}
          title="Ver siguiente afiche"
          className={`absolute bottom-0 left-0 w-56 sm:w-64 h-72 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/90 bg-slate-900 cursor-pointer
            transition-all duration-500 ease-out group hover:scale-105
            ${animating
              ? "scale-105 -translate-x-4 translate-y-4 -rotate-3 opacity-0"
              : "scale-100 translate-x-0 translate-y-0 rotate-0 opacity-100"
            }
          `}
          style={{ zIndex: 10 }}
        >
          {nextVideo ? (
            <div className="w-full h-full bg-slate-950 relative">
              <video
                src={nextVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={nextImage || undefined}
                className="w-full h-full object-cover"
              />
            </div>
          ) : nextImage ? (
            <img
              src={nextImage}
              alt={nextTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
              <BookOpen size={36} className="text-purple-400/80 mb-2" />
              <span className="text-[10px] text-gold-400 font-bold uppercase tracking-wider">
                Cursos FACOP
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent text-white space-y-0.5">
            <span className="text-[9px] text-gold-400 font-bold uppercase tracking-wider block">
              Siguiente afiche • {new Date(nextDate).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
            </span>
            <h5 className="text-xs font-bold leading-tight line-clamp-2 text-white">
              {nextTitle}
            </h5>
          </div>
        </div>
      )}

      {/* ── TARJETA PRINCIPAL DESTACADA — Al clic abre el curso/publicidad correspondiente ── */}
      <div
        onClick={handleMainCardClick}
        title={`Abrir: ${activeTitle}`}
        className={`absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/15 bg-slate-950 border border-slate-700/60 cursor-pointer
          transition-all duration-500 ease-out group/maincard
          ${animating
            ? "translate-x-8 translate-y-4 opacity-0 scale-95"
            : "translate-x-0 translate-y-0 opacity-100 scale-100"
          }
        `}
        style={{ zIndex: 20, width: totalItems > 1 ? "76%" : "100%", height: "100%" }}
      >
        {activeVideo ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <video
              ref={videoRef}
              key={activeVideo}
              src={activeVideo}
              autoPlay
              muted
              playsInline
              preload="auto"
              poster={activeImage || undefined}
              onEnded={() => next()}
              onError={() => next()}
              className="w-full h-full object-cover group-hover/maincard:scale-[1.02] transition-transform duration-500"
            />
          </div>
        ) : activeImage ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <img
              src={activeImage}
              alt={activeTitle}
              className="w-full h-full object-cover group-hover/maincard:scale-[1.02] transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1F0A2E] via-[#12081F] to-[#0A0512] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center mb-3 shadow-inner">
              <BookOpen size={36} className="text-gold-400" />
            </div>
            <span className="text-xs font-extrabold text-gold-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles size={13} />
              Cursos y Posgrados Odontológicos
            </span>
            <p className="text-xs text-slate-400 font-light max-w-xs">
              Formación de posgrado y capacitación continua con docentes líderes.
            </p>
          </div>
        )}

        {/* Franja opaca únicamente en la parte inferior para máxima legibilidad del texto blanco */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-20 space-y-1 bg-slate-950/85 backdrop-blur-md border-t border-white/10 rounded-b-3xl">
          {activeIsCourse && (
            <div className="flex items-center gap-2 text-gold-400">
              <CalendarDays size={13} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gold-400">
                Inicio: {new Date(activeDate).toLocaleDateString("es-EC", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
          <h3 className="font-extrabold text-white text-base sm:text-lg leading-snug line-clamp-2 group-hover/maincard:text-gold-300 transition-colors">
            {activeTitle}
          </h3>
          <p className="text-slate-200 text-xs leading-relaxed line-clamp-2 font-light">
            {activeDesc || "Capacitación de posgrado con especialistas de alto nivel."}
          </p>
        </div>
      </div>
    </div>
  );
}









