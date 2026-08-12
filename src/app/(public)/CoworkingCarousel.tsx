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
  video_url?: string | null;
  created_at: string;
  category?: string;
}

interface Props {
  posts: Post[];
}

export default function CoworkingCarousel({ posts }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const totalItems = posts.length;

  const next = useCallback(() => {
    if (totalItems <= 1 || animating) return;
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % totalItems);
      setAnimating(false);
    }, 420);
  }, [totalItems, animating]);

  useEffect(() => {
    if (totalItems <= 1) return;
    const interval = setInterval(next, 6500);
    return () => clearInterval(interval);
  }, [next, totalItems]);

  if (totalItems === 0) return null;

  const activePost = posts[currentIndex];
  const nextPost = posts[(currentIndex + 1) % totalItems];

  return (
    <div
      className="relative w-full h-[520px] sm:h-[580px] cursor-pointer select-none"
      onClick={next}
      title="Clic para ver el siguiente artículo"
    >
      {/* ── TARJETA SECUNDARIA SUPERPUESTA — Esquina inferior izquierda ── */}
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
          {nextPost.video_url ? (
            <div className="w-full h-full bg-slate-950 relative">
              <video
                src={nextPost.video_url}
                autoPlay
                muted
                loop
                playsInline
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
            <div className="w-full h-full bg-purple-100 flex items-center justify-center">
              <Users size={36} className="text-purple-400" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent text-white space-y-0.5">
            <span className="text-[9px] text-gold-400 font-bold uppercase tracking-wider block">
              Siguiente afiche • {new Date(nextPost.created_at).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
            </span>
            <h5 className="text-xs font-bold leading-tight line-clamp-2 text-white">
              {nextPost.title}
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
        {activePost.video_url ? (
          <div className="absolute inset-0 w-full h-full bg-slate-950">
            <video
              src={activePost.video_url}
              autoPlay
              muted
              loop
              playsInline
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
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex items-center justify-center">
            <Users size={56} className="text-purple-400 opacity-40" />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 pt-24 z-10 space-y-3 bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent">
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-white text-base sm:text-xl leading-snug line-clamp-2 drop-shadow-md">
              {activePost.title}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed line-clamp-2 font-light">
              {activePost.content}
            </p>
          </div>

          <div className="flex items-center pt-3 border-t border-white/15">
            <Link
              href={`/noticias/${activePost.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="w-full inline-flex items-center justify-between text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors group"
            >
              <span>Leer información de CoWorking completa</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}






