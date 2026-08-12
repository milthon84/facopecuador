import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CalendarDays,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  Phone,
  Stethoscope,
  Sparkles,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import CursosSection from "./CursosSection";
import ClinicaCarousel from "./ClinicaCarousel";
import CoworkingCarousel from "./CoworkingCarousel";
import { updateExpiredCourses, getPublicCourseVisibilityCutoffDate } from "@/lib/courses";

export const dynamic = "force-dynamic";

// Icono personalizado para TikTok
function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

export default async function HomePage() {
  const supabase = createAdminClient();

  // Auto-completar cursos expirados
  await updateExpiredCourses(supabase);

  // 1. Obtener configuraciones del sitio
  const { data: settingsData } = await supabase
    .from("web_settings")
    .select("key, value");

  const settings: Record<string, any> = {};
  settingsData?.forEach((item) => {
    settings[item.key] = item.value;
  });

  // Valores por defecto si no existen en BD
  const hero = settings.hero || {
    title: "Facop Ecuador Quito",
    subtitle: "Referentes en odontología clínica avanzada y formación académica de especialistas de alto nivel en Ecuador.",
    cta_text: "",
    cta_whatsapp_text: ""
  };

  const about = settings.about || {
    mission: "Brindar atención dental con estándares de vanguardia, impulsar el crecimiento de la comunidad odontológica a través de capacitación continua de posgrado y facilitar espacios equipados para la práctica profesional independiente.",
    vision: "Consolidarnos como la institución líder del Ecuador en servicios odontológicos especializados y educación odontológica continua de nivel internacional."
  };

  const contact = settings.contact || {
    phone: "0998214857",
    whatsapp_link: "https://wa.me/593998214857",
    facebook_url: "https://www.facebook.com/profile.php?id=61589831153563",
    instagram_url: "https://www.instagram.com/clinicaodontologicafacop_uio/",
    tiktok_url: "https://www.tiktok.com/@facopquito",
    address: "Quito, Ecuador"
  };

  // 2. Auto-actualizar estados de cursos y obtener cursos públicos
  await updateExpiredCourses(supabase);
  const cutoffDate = getPublicCourseVisibilityCutoffDate();

  const { data: rawCourses } = await supabase
    .from("cursos")
    .select("id, name, description, total_cost, start_date, end_date, image_url, status")
    .in("status", ["active", "in_progress", "completed"])
    .order("start_date", { ascending: true });

  const courses = (rawCourses || []).filter((c) => {
    if (c.status === "completed") {
      return c.end_date >= cutoffDate;
    }
    return true;
  });

  // 3. Obtener noticias publicadas y vigentes (no expiradas) — últimas 6
  const { data: posts, error: postsError } = await supabase
    .from("web_posts")
    .select("id, title, slug, content, image_url, created_at, category, expires_at")
    .eq("status", "published")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(6);

  if (postsError) {
    console.error("Error al obtener web_posts:", postsError.message);
  }

  const cursosPosts = (posts || []).filter((p) => p.category === "cursos");
  const clinicaPosts = (posts || []).filter((p) => p.category === "clinica");
  const coworkingPosts = (posts || []).filter((p) => p.category === "coworking");

  // Enlace de WhatsApp con mensaje específico para consultas de CoWorking
  const coworkingWaMessage = encodeURIComponent(
    "Hola FACOP Ecuador, quiero más información sobre el CoWorking Dental."
  );
  const coworkingWaLink = `${contact.whatsapp_link.split("?")[0]}?text=${coworkingWaMessage}`;

  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "FACOP Ecuador";

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#F1F5F9] text-slate-900 selection:bg-slate-900 selection:text-white font-sans overflow-x-hidden">
      
      {/* ── IMÁGENES PURAS DE ORTODONCIA DEGRADADAS EN BORDES LATERALES ── */}
      {/* EXTREMO IZQUIERDO: BRACKETS PURAS SIN TEXTO */}
      <div className="fixed left-0 top-0 bottom-0 w-[22vw] max-w-[320px] pointer-events-none z-0 hidden xl:block overflow-hidden">
        <img
          src="/images/ortho-bg-left.jpg"
          alt=""
          className="w-full h-full object-cover opacity-[0.16] mix-blend-multiply filter contrast-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/10 via-transparent to-[#F8FAFC]" />
      </div>

      {/* EXTREMO DERECHO: SONRISA PURA SIN TEXTO */}
      <div className="fixed right-0 top-0 bottom-0 w-[22vw] max-w-[320px] pointer-events-none z-0 hidden xl:block overflow-hidden">
        <img
          src="/images/ortho-bg-right.jpg"
          alt=""
          className="w-full h-full object-cover opacity-[0.16] mix-blend-multiply filter contrast-105"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-900/10 via-transparent to-[#F8FAFC]" />
      </div>

      {/* ── AMBIENT LIGHTING ORBS SUAVES (SIN NINGÚN TINTE MORADO) ── */}
      <div className="absolute top-32 -left-40 w-96 h-96 bg-slate-300/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] -right-40 w-96 h-96 bg-amber-200/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-[70%] -left-40 w-96 h-96 bg-slate-300/20 blur-[140px] rounded-full pointer-events-none" />

      {/* ── MENÚ DE NAVEGACIÓN PRINCIPAL (HEADER FIJO 100% CRISTALINO) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/90 shadow-sm transition-all">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-12 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt={clinicName} className="h-11 sm:h-13 w-auto object-contain transition-transform group-hover:scale-105" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-9 text-sm font-semibold text-slate-700">
            <Link href="#cursos" className="hover:text-purple-900 transition-colors py-1 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-purple-900 hover:after:w-full after:transition-all">
              Eventos y Cursos
            </Link>
            <Link href="#ventajas" className="hover:text-purple-900 transition-colors py-1 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-purple-900 hover:after:w-full after:transition-all">
              Clínica
            </Link>
            <Link href="#coworking" className="hover:text-purple-900 transition-colors py-1 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-purple-900 hover:after:w-full after:transition-all">
              Coworking
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            {contact.facebook_url && (
              <a
                href={contact.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:text-purple-900 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 shadow-sm"
              >
                <Facebook size={16} />
              </a>
            )}
            {contact.instagram_url && (
              <a
                href={contact.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:text-purple-900 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 shadow-sm"
              >
                <Instagram size={16} />
              </a>
            )}
            {contact.tiktok_url && (
              <a
                href={contact.tiktok_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 hover:text-purple-900 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 shadow-sm"
              >
                <TikTokIcon size={16} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── SECCIÓN HERO (CON POST-ITS TRASLÚCIDOS COLGADOS SIN BORDE FACOP UIO) ── */}
      <section className="px-4 sm:px-8 lg:px-12 pt-24 pb-4 max-w-[1400px] mx-auto relative">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 h-[260px] sm:h-[340px] lg:h-[400px] flex items-center justify-center">
          
          {/* POST-ITS FLOTANTES TRASLÚCIDOS SIN BORDE — FACOP UIO */}
          <div className="hidden lg:flex absolute top-0 right-16 z-30 gap-2 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-purple-950/75 backdrop-blur-md border-0 shadow-lg opacity-90 rotate-6 flex items-center justify-center text-gold-400 font-extrabold text-xs tracking-wider">
              FACOP
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#C9A961]/75 backdrop-blur-md border-0 shadow-md opacity-90 -rotate-6 flex items-center justify-center text-slate-950 font-extrabold text-[11px] tracking-wider">
              UIO
            </div>
          </div>

          {/* Video de fondo */}
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/facop-intro.mp4" type="video/mp4" />
          </video>
          
          {/* Gradiente overlay sutil */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#150A24]/85 via-[#150A24]/45 to-transparent pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto text-center text-white px-6 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/25 backdrop-blur-md text-white text-xs font-semibold tracking-wide shadow-md">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              Institución Odontológica de Alto Nivel en Ecuador
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md">
              {hero.title}
            </h1>
            
            <p className="hidden sm:block text-xs sm:text-base text-slate-200 max-w-xl mx-auto font-light leading-relaxed drop-shadow">
              {hero.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 1: CURSOS Y DIPLOMADOS ── */}
      <section id="cursos" className="px-4 sm:px-8 lg:px-12 py-6 max-w-[1400px] mx-auto relative">
        <div className="relative bg-gradient-to-l from-purple-200/40 via-purple-50/20 via-60% to-transparent p-6 sm:p-8 lg:p-10 shadow-none rounded-3xl">
          <CursosSection
            courses={courses || []}
            posts={cursosPosts}
            whatsappPhone={contact.phone}
            whatsappLink={contact.whatsapp_link}
          />
        </div>
      </section>

      {/* ── SECCIÓN 2: LA CLÍNICA ── */}
      <section id="ventajas" className="px-4 sm:px-8 lg:px-12 py-6 max-w-[1400px] mx-auto relative">
        <div className="relative bg-gradient-to-r from-amber-200/40 via-amber-50/20 via-60% to-transparent p-6 sm:p-8 lg:p-10 shadow-none rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* LADO IZQUIERDO: 6 columnas — Título, Descripción, Métricas y Botón */}
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.12] tracking-tight">
                Centro de Especialidades Odontológicas
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal max-w-lg">
                Tratamientos odontológicos integrales respaldados por expertos clínicos de nivel internacional, protocolos bioseguros y equipamiento de máxima tecnología.
              </p>

              {/* METRICAS / BENEFICIOS EJECUTIVOS DE LA CLINICA */}
              <div className="grid grid-cols-3 gap-3 pt-1 border-y border-amber-200/60 py-4 max-w-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <ShieldCheck size={14} className="text-amber-600 flex-shrink-0" />
                    <span>Tecnología 3D</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Diagnóstico digital</p>
                </div>

                <div className="space-y-1 border-l border-amber-200/60 pl-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Clock size={14} className="text-amber-600 flex-shrink-0" />
                    <span>Atención 24/7</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Citas y emergencias</p>
                </div>

                <div className="space-y-1 border-l border-amber-200/60 pl-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Sparkles size={14} className="text-amber-600 flex-shrink-0" />
                    <span>Estética</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Diseño de sonrisa</p>
                </div>
              </div>
              
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link 
                  href="/cita-clinica" 
                  className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#3B154C] via-[#4A1C5F] to-[#2E103C] hover:from-[#2E103C] hover:to-[#3E1650] text-white text-xs sm:text-sm font-semibold shadow-xl shadow-purple-950/15 transition-all duration-200 active:scale-[0.98] group"
                >
                  <CalendarDays size={17} className="group-hover:scale-110 transition-transform text-gold-400" />
                  <span>Reservar cita ahora</span>
                </Link>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Horarios continuos</span>
                </div>
              </div>
            </div>

            {/* LADO DERECHO: 6 columnas — Carrusel de la Clínica superpuesto */}
            <div className="lg:col-span-6 w-full">
              <ClinicaCarousel posts={clinicaPosts} />
            </div>

          </div>
        </div>
      </section>

      {/* ── SECCIÓN 3: COWORKING DENTAL ── */}
      <section id="coworking" className="px-4 sm:px-8 lg:px-12 py-6 max-w-[1400px] mx-auto relative">
        <div className="relative bg-gradient-to-l from-slate-200/40 via-slate-50/20 via-60% to-transparent p-6 sm:p-8 lg:p-10 shadow-none rounded-3xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* LADO IZQUIERDO: 6 columnas — Carrusel de CoWorking superpuesto */}
            <div className="lg:col-span-6 w-full">
              <CoworkingCarousel posts={coworkingPosts} />
            </div>

            {/* LADO DERECHO: 6 columnas — Título, Descripción, Métricas y Botón */}
            <div className="lg:col-span-6 space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.12] tracking-tight">
                CoWorking Dental
              </h2>
              
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal max-w-lg">
                Espacio clínico completamente equipado y listo para atender a tus pacientes. Arrienda por horas o días sin contratos de largo plazo.
              </p>

              {/* METRICAS / BENEFICIOS EJECUTIVOS DE COWORKING */}
              <div className="grid grid-cols-3 gap-3 pt-1 border-y border-slate-200/80 py-4 max-w-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Briefcase size={14} className="text-purple-700 flex-shrink-0" />
                    <span>Equipado</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Sillones e insumos</p>
                </div>

                <div className="space-y-1 border-l border-slate-200/80 pl-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <Clock size={14} className="text-purple-700 flex-shrink-0" />
                    <span>Flexibilidad</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Por horas o días</p>
                </div>

                <div className="space-y-1 border-l border-slate-200/80 pl-3">
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                    <ShieldCheck size={14} className="text-purple-700 flex-shrink-0" />
                    <span>Ubicación</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-light leading-snug">Zona ejecutiva Quito</p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <a
                  href={coworkingWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#3B154C] via-[#4A1C5F] to-[#2E103C] hover:from-[#2E103C] hover:to-[#3E1650] text-white text-xs sm:text-sm font-semibold shadow-xl shadow-purple-950/15 transition-all duration-200 active:scale-[0.98] group"
                >
                  <Stethoscope size={17} className="group-hover:scale-110 transition-transform text-gold-400" />
                  <span>Reservar espacio</span>
                </a>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Reserva directa WhatsApp</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PIE DE PÁGINA (FOOTER EJECUTIVO OSCURO CON ACENTOS DORADOS FULL-WIDTH) ── */}
      <footer id="nosotros" className="relative z-20 w-full bg-[#0E0919] text-slate-300 border-t border-slate-800 px-6 sm:px-8 lg:px-12 py-10 mt-12 text-xs font-light">
        <div className="max-w-[1400px] mx-auto space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Misión */}
            <div className="space-y-2">
              <h5 className="font-semibold text-gold-400 uppercase tracking-wider text-xs border-l-2 border-gold-400 pl-2.5">
                Misión
              </h5>
              <p className="text-slate-300 leading-relaxed text-xs">{about.mission}</p>
            </div>

            {/* Visión */}
            <div className="space-y-2">
              <h5 className="font-semibold text-gold-400 uppercase tracking-wider text-xs border-l-2 border-gold-400 pl-2.5">
                Visión
              </h5>
              <p className="text-slate-300 leading-relaxed text-xs">{about.vision}</p>
            </div>

            {/* Contacto & Horario */}
            <div className="space-y-2.5 md:border-l border-slate-800 md:pl-8">
              <h5 className="font-semibold text-gold-400 uppercase tracking-wider text-xs border-l-2 border-gold-400 pl-2.5 md:border-l-0 md:pl-0">
                Contacto
              </h5>
              <div className="space-y-2 text-slate-300 text-xs">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-gold-400 flex-shrink-0" />
                  <span className="truncate">{contact.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-gold-400 flex-shrink-0" />
                  <span>Tel: {contact.phone}</span>
                  {contact.whatsapp_link && (
                    <a
                      href={contact.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="ml-1 text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1 font-medium"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.855L0 24l6.303-1.654A11.941 11.941 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.213-3.737.98.998-3.648-.234-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                      </svg>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-gold-400 flex-shrink-0" />
                  <span>Lun-Vie: 9-18 / Sáb: 9-13 <span className="text-red-400 font-medium">(Dom: Cerrado)</span></span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row justify-between text-xs text-slate-500">
            <span>© {new Date().getFullYear()} {clinicName}. Todos los derechos reservados.</span>
            <span>Desarrollado para NIAGSA</span>
          </div>

        </div>
      </footer>
    </main>
  );
}
