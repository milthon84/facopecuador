"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Settings, Save, Eye } from "lucide-react";
import { saveWebSettingsAction } from "./actions";

interface Props {
  initialSettings: Record<string, any>;
  canEdit?: boolean;
}

export default function SitioWebClientPage({ initialSettings, canEdit = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados de Configuración General
  const [heroTitle, setHeroTitle] = useState(initialSettings.hero?.title || "");
  const [heroSubtitle, setHeroSubtitle] = useState(initialSettings.hero?.subtitle || "");
  const [heroCtaText, setHeroCtaText] = useState(initialSettings.hero?.cta_text || "");
  const [heroCtaWhatsappText, setHeroCtaWhatsappText] = useState(initialSettings.hero?.cta_whatsapp_text || "");

  const [aboutMission, setAboutMission] = useState(initialSettings.about?.mission || "");
  const [aboutVision, setAboutVision] = useState(initialSettings.about?.vision || "");

  const [contactPhone, setContactPhone] = useState(initialSettings.contact?.phone || "");
  const [contactWhatsappLink, setContactWhatsappLink] = useState(initialSettings.contact?.whatsapp_link || "");
  const [contactFacebookUrl, setContactFacebookUrl] = useState(initialSettings.contact?.facebook_url || "");
  const [contactInstagramUrl, setContactInstagramUrl] = useState(initialSettings.contact?.instagram_url || "");
  const [contactTiktokUrl, setContactTiktokUrl] = useState(initialSettings.contact?.tiktok_url || "");
  const [contactAddress, setContactAddress] = useState(initialSettings.contact?.address || "");

  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Guardar Configuración General
  async function handleSaveSettings() {
    if (!canEdit) return;
    setSettingsSuccess(false);
    setSettingsError(null);

    const hero = {
      title: heroTitle.trim(),
      subtitle: heroSubtitle.trim(),
      cta_text: heroCtaText.trim(),
      cta_whatsapp_text: heroCtaWhatsappText.trim(),
    };

    const about = {
      mission: aboutMission.trim(),
      vision: aboutVision.trim(),
    };

    const contact = {
      phone: contactPhone.trim(),
      whatsapp_link: contactWhatsappLink.trim(),
      facebook_url: contactFacebookUrl.trim(),
      instagram_url: contactInstagramUrl.trim(),
      tiktok_url: contactTiktokUrl.trim(),
      address: contactAddress.trim(),
    };

    startTransition(async () => {
      try {
        await saveWebSettingsAction(hero, about, contact);
        setSettingsSuccess(true);
        router.refresh();
      } catch (err: any) {
        setSettingsError(err.message || "Error al guardar configuraciones");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {!canEdit && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <span>🔒 <b>Modo Lectura:</b> Tu rol solo tiene permiso de visualización para la Página Web / CMS. Para realizar cambios contacta con un Administrador.</span>
        </div>
      )}

      {/* Hero Section */}
      <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
        <h2 className="text-base font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Globe size={18} className="text-gold-600" /> Sección Principal (Hero)
        </h2>
        <div className="grid gap-4">
          <div>
            <label className="label text-ink-800">Título Principal</label>
            <input
              type="text"
              className="input disabled:bg-gray-100 disabled:text-gray-500"
              disabled={!canEdit}
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
              placeholder="Ej: Clínica & Academia Odontológica FACOP"
            />
          </div>
          <div>
            <label className="label text-ink-800">Subtítulo Descriptivo</label>
            <textarea
              className="input min-h-[70px] disabled:bg-gray-100 disabled:text-gray-500"
              disabled={!canEdit}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Ej: Referentes en formación continua de posgrado y atención odontológica especializada..."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-ink-800">Texto Botón Reserva (CTA)</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={heroCtaText}
                onChange={(e) => setHeroCtaText(e.target.value)}
                placeholder="Ej: Reservar Cita Médica"
              />
            </div>
            <div>
              <label className="label text-ink-800">Texto Botón WhatsApp Cursos</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={heroCtaWhatsappText}
                onChange={(e) => setHeroCtaWhatsappText(e.target.value)}
                placeholder="Ej: Inscribirse en Cursos"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mission & Vision */}
      <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
        <h2 className="text-base font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Eye size={18} className="text-lilac-600" /> Filosofía Institucional (Misión & Visión)
        </h2>
        <div className="grid gap-4">
          <div>
            <label className="label text-ink-800">Misión de la Clínica / Academia</label>
            <textarea
              className="input min-h-[90px] disabled:bg-gray-100 disabled:text-gray-500"
              disabled={!canEdit}
              value={aboutMission}
              onChange={(e) => setAboutMission(e.target.value)}
              placeholder="Escribe la misión institucional..."
            />
          </div>
          <div>
            <label className="label text-ink-800">Visión a Futuro</label>
            <textarea
              className="input min-h-[90px] disabled:bg-gray-100 disabled:text-gray-500"
              disabled={!canEdit}
              value={aboutVision}
              onChange={(e) => setAboutVision(e.target.value)}
              placeholder="Escribe la visión institucional..."
            />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
        <h2 className="text-base font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <Settings size={18} className="text-gold-600" /> Datos de Contacto y Redes
        </h2>
        <div className="grid gap-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label text-ink-800">Teléfono Público</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Ej: 0998214857"
              />
            </div>
            <div>
              <label className="label text-ink-800">Enlace de WhatsApp Corporativo</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={contactWhatsappLink}
                onChange={(e) => setContactWhatsappLink(e.target.value)}
                placeholder="Ej: https://wa.me/593..."
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label text-ink-800">Enlace Facebook</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={contactFacebookUrl}
                onChange={(e) => setContactFacebookUrl(e.target.value)}
                placeholder="URL de Facebook"
              />
            </div>
            <div>
              <label className="label text-ink-800">Enlace Instagram</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={contactInstagramUrl}
                onChange={(e) => setContactInstagramUrl(e.target.value)}
                placeholder="URL de Instagram"
              />
            </div>
            <div>
              <label className="label text-ink-800">Enlace TikTok</label>
              <input
                type="text"
                className="input disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!canEdit}
                value={contactTiktokUrl}
                onChange={(e) => setContactTiktokUrl(e.target.value)}
                placeholder="URL de TikTok"
              />
            </div>
          </div>
          <div>
            <label className="label text-ink-800">Dirección Física de la Clínica</label>
            <input
              type="text"
              className="input disabled:bg-gray-100 disabled:text-gray-500"
              disabled={!canEdit}
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="Ej: Sector Iñaquito, Av. de los Shyris, Quito, Ecuador"
            />
          </div>
        </div>
      </div>

      {/* Feedback Messages */}
      {settingsSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl">
          ¡Configuraciones guardadas correctamente en la base de datos y aplicadas al portal público!
        </div>
      )}
      {settingsError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {settingsError}
        </div>
      )}

      {/* Botón de envío */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            disabled={isPending}
            className="btn-primary"
          >
            <Save size={16} />
            {isPending ? "Guardando..." : "Guardar Cambios del Sitio"}
          </button>
        </div>
      )}
    </div>
  );
}
