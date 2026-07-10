"use client";

import { useState } from "react";
import { Wifi, Monitor, Coffee, Clock, Users, Stethoscope } from "lucide-react";

const slides = [
  {
    icon: <Stethoscope size={36} className="text-gold-500" />,
    tag: "Equipado",
    title: "Consultorio listo para atender",
    desc: "Unidad dental completa, equipos de diagnóstico y materiales a tu disposición.",
    bg: "from-gold-50 to-slate-100",
  },
  {
    icon: <Wifi size={36} className="text-gold-500" />,
    tag: "Conectividad",
    title: "Internet de alta velocidad",
    desc: "Fibra óptica dedicada para teleconsultas, imágenes radiológicas y sistemas clínicos.",
    bg: "from-blue-50 to-slate-100",
  },
  {
    icon: <Clock size={36} className="text-gold-500" />,
    tag: "Flexibilidad",
    title: "Reserva por horas o días",
    desc: "Elige el horario que necesitas. Sin contratos largos ni costos fijos mensuales.",
    bg: "from-slate-50 to-gold-50",
  },
];

const miniSlides = [
  {
    icon: <Monitor size={20} className="text-gold-500" />,
    label: "Cavitron dental",
  },
  {
    icon: <Coffee size={20} className="text-gold-500" />,
    label: "Sala de espera y café",
  },
  {
    icon: <Users size={20} className="text-gold-500" />,
    label: "Red de profesionales FACOP",
  },
];

export default function CoworkingShowcase() {
  const [current, setCurrent] = useState(0);
  const next = (current + 1) % slides.length;

  const active = slides[current];
  const nextSlide = slides[next];
  const miniSlide = miniSlides[current % miniSlides.length];

  return (
    <div
      className="relative w-full h-[420px] cursor-pointer select-none"
      onClick={() => setCurrent((c) => (c + 1) % slides.length)}
      title="Clic para ver más"
    >
      {/* ── TARJETA PEQUEÑA — abajo izquierda ── */}
      <div
        className="absolute bottom-0 left-0 w-52 h-48 rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden flex flex-col justify-between p-5"
        style={{ zIndex: 10 }}
      >
        <div className="w-9 h-9 rounded-xl bg-gold-50 flex items-center justify-center">
          {miniSlide.icon}
        </div>
        <div>
          <p className="text-[9px] text-gold-500 font-semibold uppercase tracking-wider mb-1">
            Incluido
          </p>
          <h4 className="text-xs font-bold text-slate-800 leading-snug">
            {miniSlide.label}
          </h4>
        </div>
      </div>

      {/* ── TARJETA PRINCIPAL — arriba derecha ── */}
      <div
        className="absolute top-0 right-0 rounded-3xl overflow-hidden shadow-2xl shadow-slate-400/30 bg-white border border-slate-100/80 flex flex-col"
        style={{ zIndex: 20, width: "73%", height: "100%" }}
      >
        {/* Área visual superior */}
        <div
          className={`w-full bg-gradient-to-br ${active.bg} flex items-center justify-center`}
          style={{ height: "52%" }}
        >
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-white/70 backdrop-blur flex items-center justify-center shadow-sm">
              {active.icon}
            </div>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-2 flex-1">
          <span className="text-[10px] text-gold-600 font-semibold uppercase tracking-widest">
            {active.tag}
          </span>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
            {active.title}
          </h3>
          <p className="text-slate-500 text-[11px] leading-relaxed font-light line-clamp-2">
            {active.desc}
          </p>
        </div>

        {/* Indicadores */}
        <div className="absolute bottom-4 right-5 flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "bg-gold-500 w-4" : "bg-slate-200 w-1.5"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
