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
} from "lucide-react";
import CursosSection from "./CursosSection";
import ClinicaCarousel from "./ClinicaCarousel";
import CoworkingCarousel from "./CoworkingCarousel";

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

  // 2. Obtener cursos activos
  const { data: courses } = await supabase
    .from("cursos")
    .select("id, name, description, total_cost, start_date, end_date, image_url")
    .eq("status", "active")
    .order("start_date", { ascending: true });

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
    <main className="min-h-screen bg-slate-50 text-slate-800 selection:bg-gold-500 selection:text-white">
      {/* ── MENÚ DE NAVEGACIÓN PRINCIPAL ── */}
      <header className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md transition-all">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt={clinicName} className="h-14 w-auto object-contain" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-600">
            <Link href="#cursos" className="hover:text-gold-600 transition">Eventos y Cursos</Link>
            <Link href="#ventajas" className="hover:text-gold-600 transition">Clínica</Link>
            <Link href="#coworking" className="hover:text-gold-600 transition">Coworking</Link>
          </nav>

          <div className="flex items-center gap-2">
            {contact.facebook_url && (
              <a
                href={contact.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-950 hover:border-slate-300 hover:bg-slate-50 transition"
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
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-950 hover:border-slate-300 hover:bg-slate-50 transition"
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
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-950 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <TikTokIcon size={16} />
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── SECCIÓN HERO ── */}
      <section className="px-6 pt-2 pb-8 lg:pt-3 lg:pb-10 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl shadow-lg h-[200px] sm:h-[240px] lg:h-[280px] flex items-center justify-center">
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
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-slate-950/10 pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto text-center text-white px-6">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 leading-tight tracking-tight">
                {hero.title}
              </h1>
              <p className="hidden sm:block text-xs sm:text-sm text-slate-300 max-w-md mx-auto mb-4 font-light leading-relaxed">
                {hero.subtitle}
              </p>
              <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-white text-[11px] font-medium tracking-wide">
                Te esperamos
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ── SECCIÓN DE CURSOS Y DIPLOMADOS (SECCIÓN 1) ── */}
      <section id="cursos" className="px-6 py-10 lg:py-15 bg-slate-100/60 border-y border-slate-200/40">
        <div className="max-w-6xl mx-auto">
          <CursosSection
            courses={courses || []}
            posts={cursosPosts}
            whatsappPhone={contact.phone}
            whatsappLink={contact.whatsapp_link}
          />
        </div>
      </section>

      {/* ── SECCIÓN DE LA CLÍNICA (SECCIÓN 2) ── */}
      <section id="ventajas" className="px-6 py-10 lg:py-15 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          
          {/* LADO IZQUIERDO: 6 columnas — título en 2 líneas, descripción y botón */}
          <div className="lg:col-span-6 space-y-4">
            <h2 className="text-2xl sm:text-[2rem] lg:text-[2.4rem] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
              Centro de Especialidades Odontológicas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light max-w-xs">
              Tratamientos odontológicos integrales respaldados por expertos y estándares internacionales.
            </p>
            
            <div className="pt-2 flex flex-col items-start gap-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                Reserva en línea, 24/7
              </span>
              <Link 
                href="/cita-clinica" 
                className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-gold-500 hover:text-gold-400 transition-all text-xs font-semibold shadow-lg group"
              >
                <CalendarDays size={15} className="text-gold-500 group-hover:scale-105 transition-transform" />
                <span>Reservar cita ahora</span>
              </Link>
            </div>
          </div>

          {/* LADO DERECHO: 6 columnas — Carrusel de artículos de la Clínica */}
          <div className="lg:col-span-6 w-full">
            <ClinicaCarousel posts={clinicaPosts} />
          </div>

        </div>
      </section>

      {/* ── SECCIÓN 3: COWORKING DENTAL ── */}
      <section id="coworking" className="px-6 py-10 lg:py-15 bg-slate-100/60 border-y border-slate-200/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">

            {/* LADO IZQUIERDO: 6 columnas — Carrusel de artículos de CoWorking */}
            <div className="lg:col-span-6 w-full">
              <CoworkingCarousel posts={coworkingPosts} />
            </div>

            {/* LADO DERECHO: 6 columnas — Título, descripción y botón */}
            <div className="lg:col-span-6 space-y-4">
              <h2 className="text-2xl sm:text-[2rem] lg:text-[2.4rem] font-extrabold text-slate-900 leading-[1.15] tracking-tight">
                CoWorking Dental
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light max-w-xs">
                Espacio clínico equipado y listo para atender. Arrienda por horas o días sin contratos fijos.
              </p>

              <div className="pt-2 flex flex-col items-start gap-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
                  Disponibilidad inmediata
                </span>
                <a
                  href={coworkingWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-gold-500 hover:text-gold-400 transition-all text-xs font-semibold shadow-lg group"
                >
                  <Stethoscope size={15} className="text-gold-500 group-hover:scale-105 transition-transform" />
                  <span>Reservar espacio</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PIE DE PÁGINA (FOOTER) ── */}
      <footer id="nosotros" className="bg-slate-950 text-slate-400 border-t border-slate-900 px-6 py-6 text-[10px]">
        <div className="max-w-6xl mx-auto space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start font-light">
            {/* Misión */}
            <div className="space-y-1">
              <h5 className="font-semibold text-gold-500 uppercase tracking-wider text-[9px] border-l border-gold-500/50 pl-2">
                Misión
              </h5>
              <p className="text-slate-400 leading-relaxed text-[10px]">{about.mission}</p>
            </div>

            {/* Visión */}
            <div className="space-y-1">
              <h5 className="font-semibold text-gold-500 uppercase tracking-wider text-[9px] border-l border-gold-500/50 pl-2">
                Visión
              </h5>
              <p className="text-slate-400 leading-relaxed text-[10px]">{about.vision}</p>
            </div>

            {/* Contacto & Horario */}
            <div className="space-y-1.5 md:border-l border-slate-900 md:pl-6">
              <h5 className="font-semibold text-gold-500 uppercase tracking-wider text-[9px] border-l border-gold-500/50 pl-2 md:border-l-0 md:pl-0">
                Contacto
              </h5>
              <div className="space-y-1 text-slate-400 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <MapPin size={11} className="text-gold-500 flex-shrink-0" />
                  <span className="truncate">{contact.address}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone size={10} className="text-gold-500 flex-shrink-0" />
                  <span>Tel: {contact.phone}</span>
                  {contact.whatsapp_link && (
                    <a
                      href={contact.whatsapp_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="WhatsApp"
                      className="ml-0.5 text-emerald-400 hover:text-emerald-300 transition-colors flex-shrink-0"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.526 5.855L0 24l6.303-1.654A11.941 11.941 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.371l-.36-.213-3.737.98.998-3.648-.234-.374A9.818 9.818 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                      </svg>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={10} className="text-gold-500 flex-shrink-0" />
                  <span>Lun-Vie: 9-18 / Sáb: 9-13 <span className="text-red-500/80 font-medium">(Dom: Cerrado)</span></span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-900 pt-3 flex flex-col sm:flex-row justify-between text-[9px] text-slate-600">
            <span>© {new Date().getFullYear()} {clinicName}. Todos los derechos reservados.</span>
            <span>Desarrollado para NIAGSA</span>
          </div>

        </div>
      </footer>
    </main>
  );
}
