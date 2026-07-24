"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Edit2, Save, Undo } from "lucide-react";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { savePostAction, deletePostAction } from "./actions";

interface Props {
  initialPosts: any[];
  hasFacebookCredentials?: boolean;
  hasInstagramCredentials?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  cursos: "Cursos",
  clinica: "Clínica",
  coworking: "CoWorking",
};

// Fecha de expiración por defecto: hoy + 2 meses (formato yyyy-mm-dd para <input type="date">)
function defaultExpiresAt(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().slice(0, 10);
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export default function PublicidadClientPage({ 
  initialPosts,
  hasFacebookCredentials = false,
  hasInstagramCredentials = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [categoryFilter, setCategoryFilter] = useState<"todos" | "cursos" | "clinica" | "coworking">("todos");

  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "published">("draft");
  const [postCategory, setPostCategory] = useState<"cursos" | "clinica" | "coworking">("clinica");
  const [postExpiresAt, setPostExpiresAt] = useState(defaultExpiresAt());
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [publishFacebook, setPublishFacebook] = useState(false);
  const [publishInstagram, setPublishInstagram] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  const filteredPosts = useMemo(() => {
    if (categoryFilter === "todos") return initialPosts;
    return initialPosts.filter((p) => p.category === categoryFilter);
  }, [initialPosts, categoryFilter]);

  // Cargar Artículo para Edición
  function handleEditPost(post: any) {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostStatus(post.status);
    setPostCategory(post.category || "clinica");
    setPostExpiresAt(post.expires_at ? new Date(post.expires_at).toISOString().slice(0, 10) : defaultExpiresAt());
    setPublishFacebook(false);
    setPublishInstagram(false);
    setHasImage(!!post.image_url);
    setHasVideo(!!post.video_url);
    setPostSuccess(false);
    setPostError(null);
  }

  // Cancelar Edición de Artículo
  function handleCancelEdit() {
    setEditingPost(null);
    setPostTitle("");
    setPostContent("");
    setPostStatus("draft");
    setPostCategory("clinica");
    setPostExpiresAt(defaultExpiresAt());
    setPublishFacebook(false);
    setPublishInstagram(false);
    setHasImage(false);
    setHasVideo(false);
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
      if (editingPost.video_url) {
        formData.append("existingVideoUrl", editingPost.video_url);
      }
    }

    formData.set("publish_to_facebook", publishFacebook ? "true" : "false");
    formData.set("publish_to_instagram", publishInstagram ? "true" : "false");

    startTransition(async () => {
      try {
        const res = await savePostAction(formData);
        if (res.publishWarning) {
          setPostError(`Guardado en web con éxito, pero falló en redes sociales: ${res.publishWarning}`);
          setPostSuccess(true);
        } else {
          setPostSuccess(true);
        }
        setPostTitle("");
        setPostContent("");
        setPostStatus("draft");
        setPostCategory("clinica");
        setPostExpiresAt(defaultExpiresAt());
        setPublishFacebook(false);
        setPublishInstagram(false);
        setHasImage(false);
        setHasVideo(false);
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
    <div className="grid lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda: Listado de artículos */}
      <div className="lg:col-span-7 space-y-4">
        <div className="card p-5 bg-white border border-lilac-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-ink-900">
              Artículos ({filteredPosts.length})
            </h2>
            <select
              className="input !w-auto text-xs py-1.5"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
            >
              <option value="todos">Todos los destinos</option>
              <option value="cursos">Cursos</option>
              <option value="clinica">Clínica</option>
              <option value="coworking">CoWorking</option>
            </select>
          </div>
          {filteredPosts.length === 0 ? (
            <p className="text-sm text-ink-600">No hay artículos para este destino todavía.</p>
          ) : (
            <div className="divide-y divide-lilac-100">
              {filteredPosts.map((post) => (
                <div key={post.id} className="py-4 flex gap-4 items-start first:pt-0 last:pb-0">
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="w-20 h-20 object-cover rounded-xl border border-lilac-100 flex-shrink-0"
                    />
                  ) : post.video_url ? (
                    <video
                      src={post.video_url}
                      className="w-20 h-20 object-cover rounded-xl border border-lilac-100 flex-shrink-0 bg-black"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-lilac-50 rounded-xl flex items-center justify-center text-lilac-400 border border-lilac-100 flex-shrink-0">
                      <FileText size={24} />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          post.status === "published"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        {post.status === "published" ? "Publicado" : "Borrador"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-lilac-50 text-lilac-700 border-lilac-200">
                        {CATEGORY_LABELS[post.category] || "Clínica"}
                      </span>
                      {isExpired(post.expires_at) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
                          Expirado
                        </span>
                      )}
                      <span className="text-xs text-ink-600">
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-ink-900 text-sm truncate">{post.title}</h3>
                    <p className="text-xs text-ink-600 line-clamp-2 mt-1">{post.content}</p>
                    {post.expires_at && (
                      <p className="text-[11px] text-ink-500 mt-1">
                        Expira: {new Date(post.expires_at).toLocaleDateString()}
                      </p>
                    )}
                    {(post.facebook_post_id || post.instagram_post_id) && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {post.facebook_post_id && (
                          <a
                            href={post.facebook_post_id}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-800 font-semibold hover:underline bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full transition"
                          >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            Facebook
                          </a>
                        )}
                        {post.instagram_post_id && (
                          <a
                            href={post.instagram_post_id}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[10px] text-pink-600 hover:text-pink-800 font-semibold hover:underline bg-pink-50 border border-pink-100 px-2 py-0.5 rounded-full transition"
                          >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.848.072 3.159 0 3.567-.014 4.847-.072 4.36-.2 6.78-2.618 6.98-6.98.059-1.28.073-1.689.073-4.848 0-3.159-.014-3.567-.073-4.847-.2-4.36-2.617-6.78-6.98-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                            </svg>
                            Instagram
                          </a>
                        )}
                      </div>
                    )}
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
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Estás seguro de quitar la imagen actual?")) {
                        editingPost.image_url = null;
                        setHasImage(false);
                        setEditingPost({ ...editingPost });
                      }
                    }}
                    className="text-[10px] text-red-600 hover:underline mt-1 block"
                  >
                    Eliminar imagen actual
                  </button>
                </div>
              )}
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setHasImage(true);
                  } else if (!editingPost?.image_url) {
                    setHasImage(false);
                  }
                }}
                className="block w-full text-xs text-ink-600
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-xl file:border-0
                  file:text-xs file:font-semibold
                  file:bg-lilac-50 file:text-lilac-700
                  hover:file:bg-lilac-100"
              />
            </div>

            <div>
              <label className="label text-ink-800">Archivo de Video</label>
              {editingPost && editingPost.video_url && (
                <div className="mb-2">
                  <p className="text-xs text-ink-600 mb-1">Video actual:</p>
                  <video
                    src={editingPost.video_url}
                    controls
                    className="h-28 w-auto object-contain rounded-lg border border-lilac-200 bg-black"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Estás seguro de quitar el video actual?")) {
                        editingPost.video_url = null;
                        setHasVideo(false);
                        setEditingPost({ ...editingPost });
                      }
                    }}
                    className="text-[10px] text-red-650 hover:underline mt-1 block"
                  >
                    Eliminar video actual
                  </button>
                </div>
              )}
              <input
                type="file"
                name="videoFile"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setHasVideo(true);
                  } else if (!editingPost?.video_url) {
                    setHasVideo(false);
                  }
                }}
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
              <label className="label text-ink-800">Destino del Artículo *</label>
              <select
                name="category"
                required
                className="input"
                value={postCategory}
                onChange={(e) => setPostCategory(e.target.value as any)}
              >
                <option value="cursos">Cursos</option>
                <option value="clinica">Clínica</option>
                <option value="coworking">CoWorking</option>
              </select>
              <p className="text-[11px] text-ink-500 mt-1">
                Define en qué sección y carrusel del sitio público aparecerá este artículo.
              </p>
            </div>

            <div>
              <label className="label text-ink-800">Fecha de Expiración *</label>
              <input
                type="date"
                name="expires_at"
                required
                value={postExpiresAt}
                onChange={(e) => setPostExpiresAt(e.target.value)}
                className="input"
              />
              <p className="text-[11px] text-ink-500 mt-1">
                Después de esta fecha el artículo se desactiva automáticamente y deja de mostrarse en los carruseles públicos. Por defecto son 2 meses desde hoy.
              </p>
            </div>

            <div>
              <label className="label text-ink-800">Estado de Publicación</label>
              <select
                name="status"
                className="input"
                value={postStatus}
                onChange={(e) => {
                  const val = e.target.value as "draft" | "published";
                  setPostStatus(val);
                  if (val === "published") {
                    if (!editingPost?.facebook_post_id && hasFacebookCredentials) setPublishFacebook(true);
                    if (!editingPost?.instagram_post_id && (hasImage || hasVideo) && hasInstagramCredentials) setPublishInstagram(true);
                  } else {
                    setPublishFacebook(false);
                    setPublishInstagram(false);
                  }
                }}
              >
                <option value="draft">Borrador (Oculto al público)</option>
                <option value="published">Publicado (Visible en el sitio web)</option>
              </select>
            </div>

            {/* Integración con Facebook e Instagram */}
            {postStatus === "published" && (
              <div className="p-3.5 bg-lilac-50/40 border border-lilac-100 rounded-xl space-y-3">
                <span className="text-xs font-bold text-ink-800 block">
                  Publicación Automática en Redes
                </span>

                {/* Facebook Checkbox */}
                {editingPost && editingPost.facebook_post_id ? (
                  <div className="flex items-center gap-2 text-[11px] text-green-700 bg-green-50/60 border border-green-200 p-2 rounded-lg">
                    <span>✓ Publicado en Facebook Page</span>
                    <a
                      href={editingPost.facebook_post_id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800 ml-auto font-medium"
                    >
                      Ver post
                    </a>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2.5 text-xs select-none ${!hasFacebookCredentials ? 'text-ink-400 opacity-60 cursor-not-allowed' : 'text-ink-700 cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      disabled={!hasFacebookCredentials}
                      checked={publishFacebook}
                      onChange={(e) => setPublishFacebook(e.target.checked)}
                      className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                    />
                    <span>
                      Compartir en Facebook Page al guardar
                      {!hasFacebookCredentials && <span className="text-[10px] text-amber-600 block">(No configurado en el servidor)</span>}
                    </span>
                  </label>
                )}

                {/* Instagram Checkbox */}
                {editingPost && editingPost.instagram_post_id ? (
                  <div className="flex items-center gap-2 text-[11px] text-green-700 bg-green-50/60 border border-green-200 p-2 rounded-lg">
                    <span>✓ Publicado en Instagram</span>
                    <a
                      href={editingPost.instagram_post_id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-600 hover:text-blue-800 ml-auto font-medium"
                    >
                      Ver post
                    </a>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2.5 text-xs select-none ${(!hasInstagramCredentials || (!hasImage && !hasVideo)) ? 'text-ink-400 opacity-60 cursor-not-allowed' : 'text-ink-700 cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      disabled={!hasInstagramCredentials || (!hasImage && !hasVideo)}
                      checked={publishInstagram}
                      onChange={(e) => setPublishInstagram(e.target.checked)}
                      className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 w-4 h-4 cursor-pointer disabled:opacity-50"
                    />
                    <span>
                      Compartir en Instagram al guardar
                      {!hasInstagramCredentials ? (
                        <span className="text-[10px] text-amber-600 block">(No configurado en el servidor)</span>
                      ) : (!hasImage && !hasVideo) ? (
                        <span className="text-[10px] text-gold-600 block">(Requiere subir una imagen o un video)</span>
                      ) : null}
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Mensajes de éxito / error */}
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
  );
}
