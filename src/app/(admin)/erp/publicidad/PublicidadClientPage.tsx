"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Edit2, Save, Undo } from "lucide-react";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { savePostAction, deletePostAction } from "./actions";

interface Props {
  initialPosts: any[];
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

export default function PublicidadClientPage({ initialPosts }: Props) {
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
        setPostCategory("clinica");
        setPostExpiresAt(defaultExpiresAt());
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
                onChange={(e) => setPostStatus(e.target.value as any)}
              >
                <option value="draft">Borrador (Oculto al público)</option>
                <option value="published">Publicado (Visible en el sitio web)</option>
              </select>
            </div>

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
