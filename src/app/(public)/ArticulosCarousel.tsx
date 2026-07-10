"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface Props {
  posts: Post[];
}

export default function ArticulosCarousel({ posts }: Props) {
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
    const interval = setInterval(next, 5000);
    return () => clearInterval(interval);
  }, [next, posts.length]);

  if (posts.length === 0) {
    return (
      <div className="relative w-full h-[400px]">
        {/* Ghost cards */}
        <div className="absolute right-4 bottom-4 w-52 h-64 bg-slate-100/80 rounded-3xl shadow-sm rotate-3" />
        <div className="absolute inset-0 w-[72%] h-full bg-white border border-slate-100 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-3 p-8 text-center">
          <FileText size={32} className="text-slate-200" />
          <p className="text-[11px] text-slate-400 font-light leading-relaxed max-w-[180px]">
            Próximamente publicaremos artículos de salud bucal.
          </p>
        </div>
      </div>
    );
  }

  const activePost = posts[currentIndex];
  const nextPost = posts[(currentIndex + 1) % posts.length];

  return (
    <div
      className="relative w-full h-[420px] cursor-pointer select-none"
      onClick={next}
      title="Clic para ver el siguiente artículo"
    >
      {/* ── TARJETA PEQUEÑA — artículo siguiente — esquina inferior derecha ── */}
      <div
        className={`absolute bottom-0 right-0 w-52 h-64 rounded-2xl overflow-hidden shadow-xl border border-slate-100 bg-white
          transition-all duration-500 ease-out
          ${animating
            ? "scale-105 translate-x-3 translate-y-3 rotate-3 opacity-0"
            : "scale-100 translate-x-0 translate-y-0 rotate-0 opacity-100"
          }
        `}
        style={{ zIndex: 10 }}
      >
        {nextPost.image_url ? (
          <img
            src={nextPost.image_url}
            alt={nextPost.title}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-gold-50 to-slate-100 flex items-center justify-center">
            <FileText size={28} className="text-slate-300" />
          </div>
        )}
        <div className="p-4 space-y-1.5">
          <p className="text-[9px] text-gold-500 font-semibold uppercase tracking-wider">
            {new Date(nextPost.created_at).toLocaleDateString("es-EC", { month: "short", year: "numeric" })}
          </p>
          <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-3">
            {nextPost.title}
          </h4>
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL — artículo actual — ocupa ~73% del ancho total ── */}
      <div
        className={`absolute top-0 left-0 rounded-3xl overflow-hidden shadow-2xl shadow-slate-400/30 bg-white border border-slate-100/80
          transition-all duration-500 ease-out
          ${animating
            ? "-translate-x-8 translate-y-4 opacity-0 scale-95"
            : "translate-x-0 translate-y-0 opacity-100 scale-100"
          }
        `}
        style={{ zIndex: 20, width: "73%", height: "100%" }}
      >
        {/* Imagen de banner */}
        {activePost.image_url ? (
          <div className="relative overflow-hidden" style={{ height: "56%" }}>
            <img
              src={activePost.image_url}
              alt={activePost.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          </div>
        ) : (
          <div
            className="w-full bg-gradient-to-br from-slate-100 via-gold-50 to-slate-50 flex items-center justify-center"
            style={{ height: "56%" }}
          >
            <FileText size={52} className="text-slate-200" />
          </div>
        )}

        {/* Contenido de texto */}
        <div className="p-6 space-y-2.5">
          <span className="text-[10px] text-gold-600 font-semibold uppercase tracking-widest">
            {new Date(activePost.created_at).toLocaleDateString("es-EC", { dateStyle: "long" })}
          </span>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
            {activePost.title}
          </h3>
          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 font-light">
            {activePost.content}
          </p>
        </div>

        {/* Pie de la tarjeta */}
        <div className="absolute bottom-4 left-6 right-6 flex justify-between items-center">
          <Link
            href={`/noticias/${activePost.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-600 hover:text-gold-800 transition-colors group"
          >
            Leer artículo
            <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </Link>

          {/* Indicador de puntos */}
          {posts.length > 1 && (
            <div className="flex gap-1.5">
              {posts.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(i);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentIndex ? "bg-gold-500 w-4" : "bg-slate-200 w-1.5"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
