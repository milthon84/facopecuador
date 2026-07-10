"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";

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
  posts: Post[];
}

export default function CoworkingCarousel({ posts }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const next = useCallback(() => {
    if (posts.length <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
      setAnimating(false);
    }, 420);
  }, [posts.length, animating]);

  useEffect(() => {
    if (posts.length <= 1) return;
    let interval: ReturnType<typeof setInterval>;
    // Desfase inicial para no rotar al mismo tiempo que el carrusel de Clínica
    const offset = setTimeout(() => {
      interval = setInterval(next, 5000);
    }, 2500);
    return () => {
      clearTimeout(offset);
      clearInterval(interval);
    };
  }, [next, posts.length]);

  if (posts.length === 0) {
    return (
      <div className="relative w-full h-[580px]">
        {/* Ghost cards */}
        <div className="absolute bottom-0 left-0 w-60 h-80 bg-slate-100/80 rounded-2xl shadow-sm -rotate-3" />
        <div className="absolute top-0 right-0 w-[73%] h-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col items-center justify-center gap-3 p-8 text-center">
          <Users size={32} className="text-slate-700 opacity-40" />
          <p className="text-[11px] text-slate-400 font-light leading-relaxed max-w-[180px]">
            Próximamente publicaremos artículos sobre CoWorking.
          </p>
        </div>
      </div>
    );
  }

  const activePost = posts[currentIndex];
  const nextPost = posts[(currentIndex + 1) % posts.length];

  return (
    <div
      className="relative w-full h-[580px] cursor-pointer select-none"
      onClick={next}
      title="Clic para ver el siguiente artículo"
    >
      {/* ── TARJETA PEQUEÑA — artículo siguiente — esquina inferior izquierda ── */}
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
        {nextPost.image_url ? (
          <img
            src={nextPost.image_url}
            alt={nextPost.title}
            className="w-full h-44 object-fill"
          />
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-gold-50 to-slate-100 flex items-center justify-center">
            <Users size={28} className="text-slate-300" />
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <p className="text-[9px] text-gold-500 font-semibold uppercase tracking-wider">
            {new Date(nextPost.created_at).toLocaleDateString("es-EC", { month: "short", year: "numeric" })}
          </p>
          <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">
            {nextPost.title}
          </h4>
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL — artículo actual — ocupa ~73% del ancho, desde la derecha ── */}
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
        {activePost.image_url ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={activePost.image_url}
              alt={activePost.title}
              className="absolute inset-0 w-full h-full object-fill"
            />
          </div>
        ) : (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
            <Users size={52} className="text-slate-700 opacity-40" />
          </div>
        )}

        {/* Contenido overlay en la parte inferior */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pt-16 z-10 space-y-3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent">
          <div className="space-y-1.5">
            <h3 className="font-bold text-white text-base sm:text-lg leading-snug line-clamp-2 drop-shadow-sm">
              {activePost.title}
            </h3>
            <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-2 font-light">
              {activePost.content}
            </p>
          </div>

          {/* Pie / Acciones */}
          <div className="flex items-center pt-1.5 border-t border-white/10">
            <Link
              href={`/noticias/${activePost.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
            >
              Leer artículo
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
