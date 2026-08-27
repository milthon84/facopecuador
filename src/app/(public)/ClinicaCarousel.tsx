"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Stethoscope, ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

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

interface Props {
  posts: Post[];
}

const DEFAULT_CLINICA_POSTS: Post[] = [
  {
    id: "default-clinica-1",
    title: "Especialidades Odontológicas Integrales de Alto Nivel",
    slug: "",
    content: "Diagnóstico 3D, implantología, ortodoncia, rehabilitación y diseño de sonrisa con protocolos bioseguros de nivel internacional.",
    image_url: null,
    created_at: new Date().toISOString(),
    category: "clinica",
  },
  {
    id: "default-clinica-2",
    title: "Atención Especializada y Diagnóstico Digital",
    slug: "",
    content: "Tratamientos personalizados respaldados por un equipo clínico multidisciplinario en instalaciones de máxima tecnología en Quito.",
    image_url: null,
    created_at: new Date().toISOString(),
    category: "clinica",
  },
];

export default function ClinicaCarousel({ posts = [] }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const displayPosts = useMemo(() => {
    if (posts && posts.length >= 2) return posts;
    if (posts && posts.length === 1) {
      const remainingDefaults = DEFAULT_CLINICA_POSTS.filter(
        (dp) => dp.title.toLowerCase() !== posts[0].title.toLowerCase()
      );
      return [...posts, ...remainingDefaults];
    }
    return DEFAULT_CLINICA_POSTS;
  }, [posts]);

  const totalItems = displayPosts.length;

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

  const activePost = displayPosts[currentIndex];
  const nextPost = displayPosts[(currentIndex + 1) % totalItems];

  // Control de avance automático:
  // - Si el afiche activo tiene VIDEO: NO se usa temporizador fijo. Avanza únicamente al terminar el video (onEnded).
  // - Si el afiche es IMAGEN o texto: Avanza de forma normal cada 5.5 segundos.
  useEffect(() => {
    if (totalItems <= 1) return;

    if (activePost?.video_url) {
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
    }, 5500);

    return () => clearInterval(interval);
  }, [next, totalItems, activePost?.video_url, currentIndex]);

  const clinicaWaMessage = encodeURIComponent(
    `Hola FACOP Ecuador, deseo agendar una consulta sobre: "${activePost.title}".`
  );
  const whatsappLink = `https://wa.me/593998214857?text=${clinicaWaMessage}`;

  return (
    <div
      className="relative w-full h-[520px] sm:h-[580px] cursor-pointer select-none group/carousel"
      onClick={() => next()}
      title="Clic para ver el siguiente artículo"
    >
      {/* ── CONTROLES MANUALES DE NAVEGACIÓN (BOTONES PREV / NEXT) ── */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <button
          onClick={prev}
          aria-label="Artículo anterior"
          className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={next}
          aria-label="Siguiente artículo"
          className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg transition-all active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── INDICADORES DE PUNTOS (DOTS) ── */}
      <div className="absolute top-5 right-6 z-30 flex items-center gap-1.5 pointer-events-auto">
        {displayPosts.map((_, idx) => (
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
            aria-label={`Ir al artículo ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-6 bg-gold-400"
                : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* ── TARJETA SECUNDARIA SUPERPUESTA — Esquina inferior derecha (Precarga activa) ── */}
      {totalItems > 1 && (
        <div
          className={`absolute bottom-0 right-0 w-56 sm:w-64 h-72 sm:h-80 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/90 bg-slate-900
            transition-all duration-500 ease-out group hover:scale-105
            ${animating
              ? "scale-105 translate-x-4 translate-y-4 rotate-3 opacity-0"
              : "scale-100 translate-x-0 translate-y-0 rotate-0 opacity-100"
            }
          `}
          style={{ zIndex: 10 }}
        >
          {nextPost.video_url ? (
            <div className="w-full h-full bg-slate-950 relative">
              <video
                src={nextPost.video_url}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={nextPost.image_url || undefined}
                className="w-full h-full object-cover"
              />
            </div>
          ) : nextPost.image_url ? (
            <img
              src={nextPost.image_url}
              alt={nextPost.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
              <Stethoscope size={36} className="text-amber-400/80 mb-2" />
              <span className="text-[10px] text-gold-400 font-bold uppercase tracking-wider">
                Clínica FACOP
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent text-white space-y-0.5">
            <span className="text-[9px] text-gold-400 font-bold uppercase tracking-wider block">
              Siguiente afiche • {new Date(nextPost.created_at).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
            </span>
            <h5 className="text-xs font-bold leading-tight line-clamp-2 text-white">
              {nextPost.title}
            </h5>
          </div>
        </div>
      )}

      {/* ── TARJETA PRINCIPAL DESTACADA — Ocupa ~76% del ancho desde la izquierda ── */}
      <div
        className={`absolute top-0 left-0 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/15 bg-slate-950 border border-slate-700/60
          transition-all duration-500 ease-out
          ${animating
            ? "-translate-x-8 translate-y-4 opacity-0 scale-95"
            : "translate-x-0 translate-y-0 opacity-100 scale-100"
          }
        `}
        style={{ zIndex: 20, width: totalItems > 1 ? "76%" : "100%", height: "100%" }}
      >
        {activePost.video_url ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <video
              ref={videoRef}
              key={activePost.video_url}
              src={activePost.video_url}
              autoPlay
              muted
              playsInline
              preload="auto"
              poster={activePost.image_url || undefined}
              onEnded={() => next()}
              onError={() => next()}
              className="w-full h-full object-cover"
            />
          </div>
        ) : activePost.image_url ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <img
              src={activePost.image_url}
              alt={activePost.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#2D1A05] via-[#1A1005] to-[#0D0803] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-500/30 flex items-center justify-center mb-3 shadow-inner">
              <Stethoscope size={36} className="text-gold-400" />
            </div>
            <span className="text-xs font-extrabold text-gold-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles size={13} />
              FACOP Clínica Odontológica
            </span>
            <p className="text-xs text-slate-400 font-light max-w-xs">
              Especialidades clínicas avanzadas con tecnología digital y atención personalizada.
            </p>
          </div>
        )}

        {/* Gradiente Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent pointer-events-none" />

        <div className="absolute bottom-0 left-0 right-0 p-6 pt-24 z-10 space-y-3">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-gold-400 text-[10px] font-bold tracking-wider uppercase">
              <Sparkles size={11} />
              {activePost.video_url ? "Video Promocional" : "Servicios Clínicos"}
            </span>
            <h3 className="font-extrabold text-white text-base sm:text-xl leading-snug line-clamp-2 drop-shadow-md">
              {activePost.title}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 font-light">
              {activePost.content}
            </p>
          </div>

          <div className="flex items-center pt-3 border-t border-white/15">
            {activePost.slug ? (
              <Link
                href={`/noticias/${activePost.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="w-full inline-flex items-center justify-between text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
              >
                <span>Leer artículo clínico completo</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full inline-flex items-center justify-between text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
              >
                <span>Agendar consulta WhatsApp</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}








