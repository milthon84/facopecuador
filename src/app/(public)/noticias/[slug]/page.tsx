import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, FileText, Phone, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function NoticiaDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // Obtener el artículo por slug
  const { data: post } = await supabase
    .from("web_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) {
    return notFound();
  }

  // Obtener teléfono y enlace de whatsapp de contacto
  const { data: settingsData } = await supabase
    .from("web_settings")
    .select("key, value")
    .eq("key", "contact")
    .single();

  const contact = settingsData?.value || {
    phone: "0998214857",
    whatsapp_link: "https://wa.me/593998214857"
  };

  const clinicName = process.env.NEXT_PUBLIC_CLINIC_NAME || "FACOP Ecuador";
  const dateLabel = new Date(post.created_at).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {/* Cabecera */}
      <header className="sticky top-0 z-40 w-full border-b border-lilac-100 bg-white/80 backdrop-blur-md">
        <div className="px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt={clinicName} className="h-10 w-auto object-contain" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gold-600 hover:text-gold-800 transition">
            <ArrowLeft size={16} /> Volver al Inicio
          </Link>
        </div>
      </header>

      {/* Contenedor Principal */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        {/* Metadatos */}
        <div className="flex items-center gap-2 text-xs text-slate-650 mb-3 uppercase tracking-wider font-medium">
          <Calendar size={14} className="text-gold-500" />
          <span>{dateLabel}</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6 leading-tight">
          {post.title}
        </h1>

        {/* Imagen Destacada */}
        {post.image_url ? (
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm mb-8">
            <img 
              src={post.image_url} 
              alt={post.title} 
              className="w-full h-auto max-h-[450px] object-cover"
            />
          </div>
        ) : (
          <div className="h-48 w-full bg-slate-100 rounded-2xl flex items-center justify-center text-slate-350 border border-slate-200 mb-8">
            <FileText size={48} />
          </div>
        )}

        {/* Cuerpo del Artículo */}
        <div className="prose prose-slate max-w-none text-sm sm:text-base leading-relaxed text-slate-700 whitespace-pre-line space-y-4">
          {post.content}
        </div>

        {/* Widget lateral / inferior de Acción */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl border border-slate-800">
          <div>
            <h3 className="font-bold text-lg text-gold-400 mb-1">¿Deseas consultarnos algo?</h3>
            <p className="text-xs text-slate-400 max-w-md">
              Escríbenos por WhatsApp o agenda una consulta directamente con nuestros profesionales independientes.
            </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Link href="/cita-clinica" className="btn-primary text-xs py-3 px-5 shadow-md justify-center flex-1 sm:flex-none">
              <CalendarDays size={14} />
              Reservar Cita
            </Link>
            <a 
              href={contact.whatsapp_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-xs font-semibold hover:bg-slate-800 transition flex-1 sm:flex-none"
            >
              <Phone size={14} className="text-green-500" />
              WhatsApp
            </a>
          </div>
        </div>
      </article>

      {/* Footer minimalista */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 mt-12">
        © {new Date().getFullYear()} {clinicName}. Todos los derechos reservados.
      </footer>
    </main>
  );
}
