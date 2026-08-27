"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, ArrowRight, ChevronLeft, ChevronRight, Sparkles, Building2 } from "lucide-react";

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

const DEFAULT_COWORKING_POSTS: Post[] = [
  {
    id: "default-coworking-1",
    title: "Consultorios Equipados para Especialistas Independientes",
    slug: "",
    content: "Alquila tu espacio clínico odontológico totalmente equipado por horas o días. Contamos con sillones de alta tecnología, autoclave, recepción y ambiente ejecutivo en Quito.",
    image_url: null,
    created_at: new Date().toISOString(),
    category: "coworking",
  },
  {
    id: "default-coworking-2",
    title: "Aulas y Quirófanos de Vanguardia",
    slug: "",
    content: "Espacios de capacitación y prácticas clínicas ideales para talleres, cursos y tratamientos especializados sin ataduras de contratos a largo plazo.",
    image_url: null,
    created_at: new Date().toISOString(),
    category: "coworking",
  },
  {
    id: "default-coworking-3",
    title: "Flexibilidad Total y Ubicación Privilegiada",
    slug: "",
    content: "Ubicación ejecutiva estratégica en Quito con todos los servicios integrados: internet de alta velocidad, asistencia y bioseguridad garantizada.",
    image_url: null,
    created_at: new Date().toISOString(),
    category: "coworking",
  },
];

export default function CoworkingCarousel({ posts = [] }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Asegurar que siempre existan al menos 2-3 afiches para que el carrusel funcione de forma óptima
  const displayPosts = useMemo(() => {
    if (posts && posts.length >= 2) return posts;
    if (posts && posts.length === 1) {
      const remainingDefaults = DEFAULT_COWORKING_POSTS.filter(
        (dp) => dp.title.toLowerCase() !== posts[0].title.toLowerCase()
      );
      return [...posts, ...remainingDefaults];
    }
    return DEFAULT_COWORKING_POSTS;
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
  // - Si el afiche es IMAGEN o texto: Avanza de forma normal cada 6.5 segundos.
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
    }, 6500);

    return () => clearInterval(interval);
  }, [next, totalItems, activePost?.video_url, currentIndex]);

  const coworkingWaMessage = encodeURIComponent(
    `Hola FACOP Ecuador, deseo información sobre CoWorking Dental: "${activePost.title}".`
  );
  const whatsappLink = `https://wa.me/593998214857?text=${coworkingWaMessage}`;

  // Navegación al hacer clic sobre la imagen/video principal
  const handleMainCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activePost.slug) {
      router.push(`/noticias/${activePost.slug}`);
    } else {
      window.open(whatsappLink, "_blank");
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
            aria-label={`Ir al afiche ${idx + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-6 bg-gold-400"
                : "w-2 bg-white/40 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* ── TARJETA SECUNDARIA SUPERPUESTA — Esquina inferior izquierda (Al clic avanza al siguiente) ── */}
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
            <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
              <Building2 size={36} className="text-purple-400/80 mb-2" />
              <span className="text-[10px] text-gold-400 font-bold uppercase tracking-wider">
                FACOP CoWorking
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

      {/* ── TARJETA PRINCIPAL DESTACADA — Al clic abre la publicidad/noticia correspondiente ── */}
      <div
        onClick={handleMainCardClick}
        title={`Abrir publicidad: ${activePost.title}`}
        className={`absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/20 bg-slate-950 border border-slate-700/60 cursor-pointer
          transition-all duration-500 ease-out group/maincard
          ${animating
            ? "translate-x-8 translate-y-4 opacity-0 scale-95"
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
              className="w-full h-full object-cover group-hover/maincard:scale-[1.02] transition-transform duration-500"
            />
          </div>
        ) : activePost.image_url ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <img
              src={activePost.image_url}
              alt={activePost.title}
              className="w-full h-full object-cover group-hover/maincard:scale-[1.02] transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-[#1F0A2E] via-[#12081F] to-[#0A0512] flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-900/30 border border-purple-500/30 flex items-center justify-center mb-3 shadow-inner">
              <Users size={36} className="text-gold-400" />
            </div>
            <span className="text-xs font-extrabold text-gold-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Sparkles size={13} />
              FACOP CoWorking Dental
            </span>
            <p className="text-xs text-slate-400 font-light max-w-xs">
              Infraestructura clínica de posgrado y espacio quirúrgico equipado en Quito.
            </p>
          </div>
        )}

        {/* Franja opaca únicamente en la parte inferior para máxima legibilidad del texto blanco */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-20 space-y-1 bg-slate-950/85 backdrop-blur-md border-t border-white/10 rounded-b-3xl">
          <h3 className="font-extrabold text-white text-base sm:text-lg leading-snug line-clamp-2 group-hover/maincard:text-gold-300 transition-colors">
            {activePost.title}
          </h3>
          <p className="text-slate-200 text-xs leading-relaxed line-clamp-2 font-light">
            {activePost.content}
          </p>
        </div>
      </div>
    </div>
  );
}









