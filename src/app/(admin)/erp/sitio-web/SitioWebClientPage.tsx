"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, FileText, Settings, Plus, Edit2, Save, Undo, Eye } from "lucide-react";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { saveWebSettingsAction, savePostAction, deletePostAction } from "./actions";

interface Props {
  initialSettings: Record<string, any>;
  initialPosts: any[];
}

export default function SitioWebClientPage({ initialSettings, initialPosts }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"settings" | "posts">("settings");
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

  // Estados de Artículos / Noticias
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "published">("draft");
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Guardar Configuración General
  async function handleSaveSettings() {
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

  // Cargar Artículo para Edición
  function handleEditPost(post: any) {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostStatus(post.status);
    setPostSuccess(false);
    setPostError(null);
  }

  // Cancelar Edición de Artículo
  function handleCancelEdit() {
    setEditingPost(null);
    setPostTitle("");
    setPostContent("");
    setPostStatus("draft");
    setPostSuccess(false);
    setPostError(null);
  }

  // Guardar Artículo (Creación o Actualización)
  async function handleSavePost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPostSuccess(false);
    setPostError(null);

    const formData = new FormData(e.currentTarget);
    if (editingPost) {
      formData.append("id", editingPost.id);
      if (editingPost.image_url) {
        formData.append("existingImageUrl", editingPost.image_url);
      }
    }

    startTransition(async () => {
      try {
        await savePostAction(formData);
        setPostSuccess(true);
        setPostTitle("");
        setPostContent("");
        setPostStatus("draft");
        setEditingPost(null);
        // Limpiar inputs del formulario
        const form = e.target as HTMLFormElement;
        form.reset();
        router.refresh();
      } catch (err: any) {
        setPostError(err.message || "Error al guardar el artículo");
      }
    });
  }

  // Eliminar Artículo
  async function handleDeletePost(formData: FormData) {
    const id = formData.get("id") as string;
    if (!id) return;

    startTransition(async () => {
      try {
        await deletePostAction(id);
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Error al eliminar el artículo");
      }
    });
  }

  return (
    <div>
      {/* Botones de Pestañas */}
      <div className="flex border-b border-lilac-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-sm transition-all ${
            activeTab === "settings"
              ? "border-gold-500 text-ink-900 bg-gold-50/20"
              : "border-transparent text-ink-600 hover:text-ink-950"
          }`}
        >
          <Settings size={16} />
          Configuración General
        </button>
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-medium text-sm transition-all ${
            activeTab === "posts"
              ? "border-gold-500 text-ink-900 bg-gold-50/20"
              : "border-transparent text-ink-600 hover:text-ink-950"
          }`}
        >
          <FileText size={16} />
          Noticias y Artículos
        </button>
      </div>

      {/* PESTAÑA: CONFIGURACIÓN GENERAL */}
      {activeTab === "settings" && (
        <div className="space-y-6 max-w-4xl">
          {/* Hero Section */}
          <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
            <h2 className="text-base font-semibold text-ink-900 mb-4 flex items-center gap-2">
              <Globe size={18} className="text-gold-600" /> Seccion Principal (Hero)
            </h2>
            <div className="grid gap-4">
              <div>
                <label className="label text-ink-800">Título Principal</label>
                <input
                  type="text"
                  className="input"
                  value={heroTitle}
                  onChange={(e) => setHeroTitle(e.target.value)}
                  placeholder="Ej: Clínica & Academia Odontológica FACOP"
                />
              </div>
              <div>
                <label className="label text-ink-800">Subtítulo Descriptivo</label>
                <textarea
                  className="input min-h-[70px]"
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
                    className="input"
                    value={heroCtaText}
                    onChange={(e) => setHeroCtaText(e.target.value)}
                    placeholder="Ej: Reservar Cita Médica"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Texto Botón WhatsApp Cursos</label>
                  <input
                    type="text"
                    className="input"
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
                  className="input min-h-[90px]"
                  value={aboutMission}
                  onChange={(e) => setAboutMission(e.target.value)}
                  placeholder="Escribe la misión institucional..."
                />
              </div>
              <div>
                <label className="label text-ink-800">Visión a Futuro</label>
                <textarea
                  className="input min-h-[90px]"
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
                    className="input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Ej: 0998214857"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Enlace de WhatsApp Corporativo</label>
                  <input
                    type="text"
                    className="input"
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
                    className="input"
                    value={contactFacebookUrl}
                    onChange={(e) => setContactFacebookUrl(e.target.value)}
                    placeholder="URL de Facebook"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Enlace Instagram</label>
                  <input
                    type="text"
                    className="input"
                    value={contactInstagramUrl}
                    onChange={(e) => setContactInstagramUrl(e.target.value)}
                    placeholder="URL de Instagram"
                  />
                </div>
                <div>
                  <label className="label text-ink-800">Enlace TikTok</label>
                  <input
                    type="text"
                    className="input"
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
                  className="input"
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
        </div>
      )}

      {/* PESTAÑA: ARTÍCULOS Y NOTICIAS */}
      {activeTab === "posts" && (
        <div className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Listado de artículos */}
          <div className="lg:col-span-7 space-y-4">
            <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
              <h2 className="text-base font-semibold text-ink-900 mb-4">
                Noticias Publicadas ({initialPosts.length})
              </h2>
              {initialPosts.length === 0 ? (
                <p className="text-sm text-ink-600">No hay artículos publicados todavía.</p>
              ) : (
                <div className="divide-y divide-lilac-100">
                  {initialPosts.map((post) => (
                    <div key={post.id} className="py-4 flex gap-4 items-start first:pt-0 last:pb-0">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-20 h-20 object-cover rounded-xl border border-lilac-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-lilac-50 rounded-xl flex items-center justify-center text-lilac-400 border border-lilac-100 flex-shrink-0">
                          <FileText size={24} />
                        </div>
                      )}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              post.status === "published"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            }`}
                          >
                            {post.status === "published" ? "Publicado" : "Borrador"}
                          </span>
                          <span className="text-xs text-ink-600">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-ink-900 text-sm truncate">{post.title}</h3>
                        <p className="text-xs text-ink-600 line-clamp-2 mt-1">{post.content}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          onClick={() => handleEditPost(post)}
                          className="p-1.5 text-lilac-700 hover:bg-lilac-50 rounded-lg transition"
                          title="Editar artículo"
                        >
                          <Edit2 size={15} />
                        </button>
                        <ConfirmDeleteButton
                          action={handleDeletePost}
                          idValue={post.id}
                          confirmMessage={`¿Estás seguro de que deseas eliminar la noticia "${post.title}"?`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Formulario de Creación / Edición */}
          <div className="lg:col-span-5">
            <div className="card p-5 bg-white border border-lilac-100 shadow-sm sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-base font-semibold text-ink-900 flex items-center gap-1.5">
                  {editingPost ? (
                    <>
                      <Edit2 size={16} className="text-gold-600" /> Editar Artículo
                    </>
                  ) : (
                    <>
                      <Plus size={18} className="text-lilac-600" /> Crear Nuevo Artículo
                    </>
                  )}
                </h2>
                {editingPost && (
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs text-lilac-700 hover:underline flex items-center gap-1"
                  >
                    <Undo size={12} /> Cancelar edición
                  </button>
                )}
              </div>

              <form onSubmit={handleSavePost} className="space-y-4">
                <div>
                  <label className="label text-ink-800">Título del Artículo *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    placeholder="Ej: Innovador Coworking Dental en Quito..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="label text-ink-800">Imagen de Portada</label>
                  {editingPost && editingPost.image_url && (
                    <div className="mb-2">
                      <p className="text-xs text-ink-600 mb-1">Imagen actual:</p>
                      <img
                        src={editingPost.image_url}
                        alt="Preview"
                        className="h-20 w-auto object-cover rounded-lg border border-lilac-200"
                      />
                    </div>
                  )}
                  <input
                    type="file"
                    name="imageFile"
                    accept="image/*"
                    className="block w-full text-xs text-ink-600
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-xl file:border-0
                      file:text-xs file:font-semibold
                      file:bg-lilac-50 file:text-lilac-700
                      hover:file:bg-lilac-100"
                  />
                </div>

                <div>
                  <label className="label text-ink-800">Contenido del Artículo *</label>
                  <textarea
                    name="content"
                    required
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Escribe aquí el contenido completo de la noticia..."
                    className="input min-h-[160px]"
                  />
                </div>

                <div>
                  <label className="label text-ink-800">Estado de Publicación</label>
                  <select
                    name="status"
                    className="input"
                    value={postStatus}
                    onChange={(e) => setPostStatus(e.target.value as any)}
                  >
                    <option value="draft">Borrador (Oculto al público)</option>
                    <option value="published">Publicado (Visible en el sitio web)</option>
                  </select>
                </div>

                {/* Mensajes de éxito / error en post */}
                {postSuccess && (
                  <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl">
                    ¡Artículo guardado correctamente!
                  </div>
                )}
                {postError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                    {postError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary w-full"
                >
                  <Save size={16} />
                  {isPending ? "Guardando..." : editingPost ? "Actualizar Artículo" : "Publicar Artículo"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
