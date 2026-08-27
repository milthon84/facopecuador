"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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

export default function CursosCarousel({ courses, posts = [], whatsappPhone, onCourseChange }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const items: CarouselItem[] = useMemo(
    () => [
      ...courses.map((c) => ({ kind: "course" as const, data: c })),
      ...posts.map((p) => ({ kind: "post" as const, data: p })),
    ],
    [courses, posts]
  );

  const totalItems = items.length;

  useEffect(() => {
    const active = items[currentIndex];
    if (active?.kind === "course" && onCourseChange) {
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
    }, 420);
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

  if (totalItems === 0) return null;

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

  return (
    <div
      className="relative w-full h-[520px] sm:h-[580px] cursor-pointer select-none"
      onClick={() => next()}
      title="Clic para ver el siguiente afiche"
    >
      {/* ── TARJETA SECUNDARIA SUPERPUESTA — Esquina inferior izquierda (Precarga activa) ── */}
      {totalItems > 1 && (
        <div
          className={`absolute bottom-0 left-0 w-56 sm:w-64 h-72 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/90 bg-white
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
            <div className="w-full h-full bg-purple-100 flex items-center justify-center">
              <BookOpen size={36} className="text-purple-400" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent text-white space-y-0.5">
            <span className="text-[9px] text-gold-400 font-bold uppercase tracking-wider block">
              Siguiente afiche • {new Date(nextDate).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
            </span>
            <h5 className="text-xs font-bold leading-tight line-clamp-2 text-white">
              {nextTitle}
            </h5>
          </div>
        </div>
      )}

      {/* ── TARJETA PRINCIPAL DESTACADA — Ocupa ~76% del ancho desde la derecha ── */}
      <div
        className={`absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/15 bg-slate-950 border border-slate-200/80
          transition-all duration-500 ease-out
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
              className="w-full h-full object-cover"
            />
          </div>
        ) : activeImage ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <img
              src={activeImage}
              alt={activeTitle}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center">
            <BookOpen size={56} className="text-purple-400 opacity-40" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 pt-24 z-10 space-y-3 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent">
          <div className="space-y-1.5">
            {activeIsCourse && (
              <div className="flex items-center gap-2 text-gold-400">
                <CalendarDays size={13} />
                <span className="text-[11px] font-bold uppercase tracking-widest text-gold-400">
                  Inicio: {new Date(activeDate).toLocaleDateString("es-EC", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            )}
            <h3 className="font-extrabold text-white text-base sm:text-xl leading-snug line-clamp-2 drop-shadow-md">
              {activeTitle}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 font-light">
              {activeDesc || "Capacitación de posgrado con especialistas de alto nivel."}
            </p>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-white/15">
            {activeIsCourse ? (
              <>
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
                >
                  Más información
                  <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                </a>

                <Link
                  href={`/inscripcion-curso/${activeItem.data.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A961] to-[#B3934B] hover:from-[#B3934B] hover:to-[#9E7E36] text-slate-950 text-xs font-bold transition shadow-lg active:scale-[0.98]"
                >
                  <GraduationCap size={15} />
                  Inscribirse
                </Link>
              </>
            ) : (
              <Link
                href={`/noticias/${activeItem.data.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="w-full inline-flex items-center justify-between text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
              >
                <span>Leer artículo completo</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}







