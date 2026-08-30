"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Edit2,
  Undo,
  BarChart3,
  Search,
  LayoutGrid,
  LayoutList,
  Video,
  Image as ImageIcon,
  X,
  Play,
  CheckCircle2,
  Calendar,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { savePostAction, deletePostAction, togglePostStatusAction } from "./actions";
import AdsAnalyticsDashboard from "./AdsAnalyticsDashboard";

interface Props {
  initialPosts: any[];
  hasFacebookCredentials?: boolean;
  hasInstagramCredentials?: boolean;
  hasTikTokCredentials?: boolean;
  isAdmin?: boolean;
  canEdit?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  cursos: "Cursos",
  clinica: "Clínica",
  coworking: "CoWorking",
};

const ITEMS_PER_PAGE = 8;

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
  hasTikTokCredentials = false,
  isAdmin = false,
  canEdit = true,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Pestañas principales (Análisis / Artículos)
  const [mainTab, setMainTab] = useState<"analisis" | "articulos">("articulos");

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"todos" | "cursos" | "clinica" | "coworking">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "published" | "draft" | "expired">("todos");
  const [mediaFilter, setMediaFilter] = useState<"todos" | "video" | "image">("todos");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "expiring_soon" | "title">("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  // Estado para Modal de Creación / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);

  // Campos de Formulario
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postStatus, setPostStatus] = useState<"draft" | "published">("published");
  const [postCategory, setPostCategory] = useState<"cursos" | "clinica" | "coworking">("clinica");
  const [postExpiresAt, setPostExpiresAt] = useState(defaultExpiresAt());
  const [postSuccess, setPostSuccess] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [publishFacebook, setPublishFacebook] = useState(false);
  const [publishInstagram, setPublishInstagram] = useState(false);
  const [publishTikTok, setPublishTikTok] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);

  // Métricas rápidas
  const metrics = useMemo(() => {
    const total = initialPosts.length;
    const published = initialPosts.filter((p) => p.status === "published" && !isExpired(p.expires_at)).length;
    const drafts = initialPosts.filter((p) => p.status === "draft").length;
    const expired = initialPosts.filter((p) => isExpired(p.expires_at)).length;
    const withVideo = initialPosts.filter((p) => !!p.video_url).length;
    return { total, published, drafts, expired, withVideo };
  }, [initialPosts]);

  // Filtrado y Ordenamiento
  const processedPosts = useMemo(() => {
    let result = [...initialPosts];

    // Búsqueda por texto
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q)
      );
    }

    // Filtro Categoría
    if (categoryFilter !== "todos") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    // Filtro Estado
    if (statusFilter === "published") {
      result = result.filter((p) => p.status === "published" && !isExpired(p.expires_at));
    } else if (statusFilter === "draft") {
      result = result.filter((p) => p.status === "draft");
    } else if (statusFilter === "expired") {
      result = result.filter((p) => isExpired(p.expires_at));
    }

    // Filtro Formato Multimedia
    if (mediaFilter === "video") {
      result = result.filter((p) => !!p.video_url);
    } else if (mediaFilter === "image") {
      result = result.filter((p) => !!p.image_url && !p.video_url);
    }

    // Ordenamiento
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === "expiring_soon") {
        const timeA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const timeB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return 0;
    });

    return result;
  }, [initialPosts, searchTerm, categoryFilter, statusFilter, mediaFilter, sortBy]);

  // Paginación
  const totalPages = Math.ceil(processedPosts.length / ITEMS_PER_PAGE) || 1;
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedPosts.slice(start, start + ITEMS_PER_PAGE);
  }, [processedPosts, currentPage]);

  // Abrir Modal para Crear Nuevo Anuncio
  function handleOpenCreateModal() {
    setEditingPost(null);
    setPostTitle("");
    setPostContent("");
    setPostStatus("published");
    setPostCategory("clinica");
    setPostExpiresAt(defaultExpiresAt());
    setPublishFacebook(false);
    setPublishInstagram(false);
    setPublishTikTok(false);
    setHasImage(false);
    setHasVideo(false);
    setPostSuccess(false);
    setPostError(null);
    setIsModalOpen(true);
  }

  // Abrir Modal para Editar Anuncio
  function handleOpenEditModal(post: any) {
    setEditingPost(post);
    setPostTitle(post.title);
    setPostContent(post.content);
    setPostStatus(post.status);
    setPostCategory(post.category || "clinica");
    setPostExpiresAt(post.expires_at ? new Date(post.expires_at).toISOString().slice(0, 10) : defaultExpiresAt());
    setPublishFacebook(!!post.facebook_post_id);
    setPublishInstagram(!!post.instagram_post_id);
    setPublishTikTok(!!post.tiktok_post_id);
    setHasImage(!!post.image_url);
    setHasVideo(!!post.video_url);
    setPostSuccess(false);
    setPostError(null);
    setIsModalOpen(true);
  }

  // Cerrar Modal
  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingPost(null);
    setPostError(null);
    setPostSuccess(false);
  }

  // Guardar (Creación / Edición)
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
    formData.set("publish_to_tiktok", publishTikTok ? "true" : "false");

    startTransition(async () => {
      try {
        const res = await savePostAction(formData);
        if (!res.success) {
          setPostError(res.error || "Error al guardar el artículo");
          return;
        }

        if (res.publishWarning) {
          setPostError(`Guardado en web con éxito, pero falló en redes sociales: ${res.publishWarning}`);
          setPostSuccess(true);
        } else {
          setPostSuccess(true);
        }

        setTimeout(() => {
          handleCloseModal();
          router.refresh();
        }, 600);
      } catch (err: any) {
        setPostError(err.message || "Error al guardar el artículo");
      }
    });
  }

  // Cambiar Estado Rápido (Publicado <-> Borrador) en 1-Clic
  async function handleToggleStatus(post: any) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        const res = await togglePostStatusAction(post.id, post.status);
        if (!res.success) {
          alert(res.error || "No se pudo cambiar el estado.");
          return;
        }
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Error al cambiar estado.");
      }
    });
  }

  // Eliminar Anuncio
  async function handleDeletePost(formData: FormData) {
    const id = formData.get("id") as string;
    if (!id) return;

    startTransition(async () => {
      try {
        const res = await deletePostAction(id);
        if (!res.success) {
          alert(res.error || "Error al eliminar el artículo");
          return;
        }
        router.refresh();
      } catch (err: any) {
        alert(err.message || "Error al eliminar el artículo");
      }
    });
  }

  return (
    <div className="space-y-6 w-full">
      {/* ── ENCABEZADO Y NAVEGACIÓN DE PESTAÑAS PRINCIPALES ── */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setMainTab("articulos")}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            mainTab === "articulos"
              ? "border-purple-600 text-purple-950 bg-purple-50/70 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
          }`}
        >
          <FileText size={18} />
          Noticias y Artículos Web
        </button>
        <button
          type="button"
          onClick={() => setMainTab("analisis")}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            mainTab === "analisis"
              ? "border-purple-600 text-purple-950 bg-purple-50/70 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
          }`}
        >
          <BarChart3 size={18} />
          Análisis y Consumos de Anuncios
        </button>
      </div>

      {mainTab === "analisis" ? (
        <AdsAnalyticsDashboard isAdmin={isAdmin} canEdit={canEdit} />
      ) : (
        <div className="space-y-6">
          {/* ── BARRA DE MÉTRICAS RÁPIDAS (RESUMEN) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-sm">
                {metrics.total}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Anuncios</p>
                <p className="text-xs font-bold text-slate-900">Registrados</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                {metrics.published}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Publicados</p>
                <p className="text-xs font-bold text-emerald-700">En Carruseles</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                {metrics.drafts}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Borradores</p>
                <p className="text-xs font-bold text-slate-700">En revisión</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm">
                {metrics.expired}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Expirados</p>
                <p className="text-xs font-bold text-rose-700">Vencidos</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 col-span-2 sm:col-span-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                {metrics.withVideo}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Con Video</p>
                <p className="text-xs font-bold text-amber-700">Multimedia</p>
              </div>
            </div>
          </div>

          {/* ── BARRA SUPERIOR DE BÚSQUEDA, FILTROS Y BOTÓN "+ NUEVO ANUNCIO" ── */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Búsqueda en tiempo real */}
              <div className="relative flex-grow max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Buscar anuncio por título o contenido..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-purple-600 transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Selector de Vista (Lista vs Galería Tarjetas) */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === "grid"
                        ? "bg-white text-purple-950 shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Vista Galería (Tarjetas)"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-lg transition-all ${
                      viewMode === "list"
                        ? "bg-white text-purple-950 shadow-sm font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Vista Lista Compacta"
                  >
                    <LayoutList size={16} />
                  </button>
                </div>

                {/* BOTÓN PRINCIPAL DE CREACIÓN (+ Crear Nuevo Anuncio en Popup Modal) */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-700 via-purple-800 to-slate-900 hover:from-purple-800 hover:to-slate-950 text-white text-xs font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95"
                  >
                    <Plus size={16} />
                    <span>Crear Nuevo Anuncio</span>
                  </button>
                )}
              </div>
            </div>

            {/* Segunda fila de filtros avanzados */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Filter size={12} /> Filtros:
              </span>

              {/* Filtro Destino */}
              <select
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-600 cursor-pointer"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
              >
                <option value="todos">Todos los Destinos</option>
                <option value="cursos">Cursos</option>
                <option value="clinica">Clínica</option>
                <option value="coworking">CoWorking</option>
              </select>

              {/* Filtro Estado */}
              <select
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-600 cursor-pointer"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
              >
                <option value="todos">Todos los Estados</option>
                <option value="published">🟢 Publicados</option>
                <option value="draft">⚪ Borradores</option>
                <option value="expired">🔴 Expirados</option>
              </select>

              {/* Filtro Formato Multimedia */}
              <select
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-600 cursor-pointer"
                value={mediaFilter}
                onChange={(e) => {
                  setMediaFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
              >
                <option value="todos">Todos los Formatos</option>
                <option value="video">🎬 Solo Videos</option>
                <option value="image">🖼️ Solo Imágenes</option>
              </select>

              {/* Ordenamiento */}
              <div className="ml-auto flex items-center gap-1.5">
                <ArrowUpDown size={12} className="text-slate-400" />
                <select
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:border-purple-600 cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="newest">Más recientes primero</option>
                  <option value="expiring_soon">Próximos a expirar</option>
                  <option value="oldest">Más antiguos primero</option>
                  <option value="title">Título (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── LISTADO / GALERÍA DE ANUNCIOS ── */}
          {processedPosts.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <FileText size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-800 text-sm">No se encontraron anuncios</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-light">
                No hay resultados que coincidan con los filtros o término de búsqueda ingresado.
              </p>
              {(searchTerm || categoryFilter !== "todos" || statusFilter !== "todos" || mediaFilter !== "todos") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("todos");
                    setStatusFilter("todos");
                    setMediaFilter("todos");
                  }}
                  className="px-4 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition"
                >
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ── VISTA GALERÍA (CUADRÍCULA DE TARJETAS) ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedPosts.map((post) => {
                const expired = isExpired(post.expires_at);

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group"
                  >
                    {/* MINIATURA / MULTIMEDIA DE PORTADA (IMAGEN O VIDEO CON PREVIEW FOTOGRAMA) */}
                    <div className="relative h-44 bg-slate-950 overflow-hidden">
                      {post.video_url ? (
                        <div className="w-full h-full relative">
                          <video
                            src={`${post.video_url}#t=0.5`}
                            preload="metadata"
                            poster={post.image_url || undefined}
                            className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20" />
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-900/90 border border-white/20 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-md">
                            <Play size={10} className="fill-white text-white" />
                            Video
                          </span>
                        </div>
                      ) : post.image_url ? (
                        <div className="w-full h-full relative">
                          <img
                            src={post.image_url}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-900/80 border border-white/20 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-md">
                            <ImageIcon size={10} />
                            Afiche
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-center">
                          <FileText size={32} className="text-purple-400/80 mb-1" />
                          <span className="text-[10px] text-gold-400 font-bold uppercase tracking-wider">
                            FACOP Ecuador
                          </span>
                        </div>
                      )}

                      {/* Insignia de Destino */}
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-500/40 text-gold-400 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                        {CATEGORY_LABELS[post.category] || "Clínica"}
                      </span>
                    </div>

                    {/* CUERPO DE LA TARJETA */}
                    <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          {/* BOTÓN TOGGLE RÁPIDO DE ESTADO (1-CLIC) */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(post)}
                            disabled={!canEdit || isPending}
                            title={canEdit ? "Clic para cambiar estado rápido" : undefined}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                              expired
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : post.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            {expired ? "🔴 Expirado" : post.status === "published" ? "🟢 Publicado" : "⚪ Borrador"}
                          </button>

                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(post.created_at).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-purple-900 transition-colors">
                          {post.title}
                        </h3>

                        <p className="text-xs text-slate-500 font-light line-clamp-2 leading-relaxed">
                          {post.content}
                        </p>
                      </div>

                      {/* PIE DE TARJETA — FECHA EXPIRACIÓN & ACCIONES */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        {post.expires_at && (
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} className="text-slate-400" />
                              Expira:
                            </span>
                            <span className={`font-semibold ${expired ? "text-rose-600" : "text-slate-700"}`}>
                              {new Date(post.expires_at).toLocaleDateString("es-EC", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        )}

                        {/* Botones Redes & Edición */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1">
                            {post.facebook_post_id && (
                              <a
                                href={post.facebook_post_id}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                                title="Ver en Facebook"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                            {post.instagram_post_id && (
                              <a
                                href={post.instagram_post_id}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded-md bg-pink-50 text-pink-600 hover:bg-pink-100 transition"
                                title="Ver en Instagram"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(post)}
                                className="p-1.5 text-purple-700 hover:bg-purple-50 rounded-lg transition"
                                title="Editar anuncio"
                              >
                                <Edit2 size={14} />
                              </button>
                              <ConfirmDeleteButton
                                action={handleDeletePost}
                                idValue={post.id}
                                confirmMessage={`¿Estás seguro de eliminar el anuncio "${post.title}"?`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── VISTA LISTA COMPACTA ── */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {paginatedPosts.map((post) => {
                const expired = isExpired(post.expires_at);

                return (
                  <div key={post.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center gap-4">
                    {/* Miniatura lista */}
                    <div className="relative w-20 h-20 rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-200">
                      {post.video_url ? (
                        <div className="w-full h-full relative">
                          <video
                            src={`${post.video_url}#t=0.5`}
                            preload="metadata"
                            poster={post.image_url || undefined}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                            <Play size={14} className="fill-white text-white" />
                          </div>
                        </div>
                      ) : post.image_url ? (
                        <img src={post.image_url} alt={post.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-purple-50 flex items-center justify-center text-purple-400">
                          <FileText size={20} />
                        </div>
                      )}
                    </div>

                    {/* Info Anuncio */}
                    <div className="flex-grow min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* TOGGLE ESTADO 1-CLIC */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(post)}
                          disabled={!canEdit || isPending}
                          title={canEdit ? "Clic para cambiar estado rápido" : undefined}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                            expired
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : post.status === "published"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {expired ? "🔴 Expirado" : post.status === "published" ? "🟢 Publicado" : "⚪ Borrador"}
                        </button>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-50 text-purple-900 border-purple-200">
                          {CATEGORY_LABELS[post.category] || "Clínica"}
                        </span>

                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(post.created_at).toLocaleDateString("es-EC")}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm truncate">{post.title}</h3>
                      <p className="text-xs text-slate-500 font-light line-clamp-1">{post.content}</p>

                      {post.expires_at && (
                        <p className="text-[11px] text-slate-400">
                          Expira: {new Date(post.expires_at).toLocaleDateString("es-EC")}
                        </p>
                      )}
                    </div>

                    {/* Acciones Editar / Eliminar */}
                    {canEdit && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(post)}
                          className="p-2 text-purple-700 hover:bg-purple-100/70 rounded-xl transition"
                          title="Editar anuncio"
                        >
                          <Edit2 size={16} />
                        </button>
                        <ConfirmDeleteButton
                          action={handleDeletePost}
                          idValue={post.id}
                          confirmMessage={`¿Estás seguro de eliminar el anuncio "${post.title}"?`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PAGINADOR DE NAVEGACIÓN ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700">
              <span className="text-slate-500 font-normal">
                Mostrando página <strong className="text-slate-900">{currentPage}</strong> de <strong className="text-slate-900">{totalPages}</strong> ({processedPosts.length} anuncios)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === page
                        ? "bg-purple-950 text-white shadow-md"
                        : "hover:bg-slate-100 text-slate-600"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── POPUP MODAL PARA CREACIÓN / EDICIÓN DE ANUNCIOS ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
            {/* Encabezado del Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center">
                  {editingPost ? <Edit2 size={16} /> : <Plus size={18} />}
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingPost ? "Editar Anuncio Publicitario" : "Crear Nuevo Anuncio Publicitario"}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario Modal */}
            <form onSubmit={handleSavePost} className="p-6 space-y-4 overflow-y-auto flex-grow">
              {postError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {postError}
                </div>
              )}
              {postSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Anuncio guardado exitosamente.</span>
                </div>
              )}

              {/* Título del Anuncio */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Título del Anuncio *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Ej: Innovador Coworking Dental en Quito..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Grid 2 Columnas: Destino y Expiración */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Destino del Anuncio *
                  </label>
                  <select
                    name="category"
                    required
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600 bg-white font-semibold text-slate-800"
                  >
                    <option value="clinica">Clínica</option>
                    <option value="cursos">Cursos</option>
                    <option value="coworking">CoWorking</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Define en qué carrusel del sitio aparecerá este afiche.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Fecha de Expiración *
                  </label>
                  <input
                    type="date"
                    name="expires_at"
                    required
                    value={postExpiresAt}
                    onChange={(e) => setPostExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600 bg-white font-semibold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Se desactiva automáticamente tras esta fecha.
                  </p>
                </div>
              </div>

              {/* Estado de Publicación */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Estado de Publicación
                </label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="published"
                      checked={postStatus === "published"}
                      onChange={() => setPostStatus("published")}
                      className="accent-purple-600"
                    />
                    <span className="text-emerald-700 font-bold">🟢 Publicado (Visible en web)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={postStatus === "draft"}
                      onChange={() => setPostStatus("draft")}
                      className="accent-purple-600"
                    />
                    <span className="text-slate-600 font-bold">⚪ Borrador (Oculto)</span>
                  </label>
                </div>
              </div>

              {/* Subida Imagen de Portada */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-purple-700" />
                  Imagen de Portada (Afiche)
                </label>
                {editingPost && editingPost.image_url && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
                    <img src={editingPost.image_url} alt="Preview" className="h-14 w-14 object-cover rounded-lg" />
                    <div className="flex-grow">
                      <p className="text-xs font-bold text-slate-800">Imagen actual en uso</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("¿Deseas quitar la imagen actual?")) {
                            editingPost.image_url = null;
                            setHasImage(false);
                            setEditingPost({ ...editingPost });
                          }
                        }}
                        className="text-[10px] text-rose-600 font-bold hover:underline"
                      >
                        Quitar imagen actual
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  name="imageFile"
                  accept="image/*"
                  onChange={(e) => setHasImage(!!e.target.files?.length)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200 cursor-pointer"
                />
              </div>

              {/* Subida Archivo de Video */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Video size={14} className="text-purple-700" />
                  Archivo de Video (Opcional - Máx 100 MB)
                </label>
                {editingPost && editingPost.video_url && (
                  <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
                    <video src={`${editingPost.video_url}#t=0.5`} preload="metadata" className="h-14 w-14 object-cover rounded-lg bg-black" />
                    <div className="flex-grow">
                      <p className="text-xs font-bold text-slate-800">Video actual cargado</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("¿Deseas quitar el video actual?")) {
                            editingPost.video_url = null;
                            setHasVideo(false);
                            setEditingPost({ ...editingPost });
                          }
                        }}
                        className="text-[10px] text-rose-600 font-bold hover:underline"
                      >
                        Quitar video actual
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  name="videoFile"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setHasVideo(!!e.target.files?.length)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-100 file:text-purple-900 hover:file:bg-purple-200 cursor-pointer"
                />
              </div>

              {/* Contenido / Descripción */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Contenido del Anuncio / Descripción *
                </label>
                <textarea
                  name="content"
                  required
                  rows={3}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Escribe aquí el texto descriptivo del anuncio..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-purple-600"
                />
              </div>

              {/* Opciones de Publicación en Redes Sociales (Meta & TikTok) */}
              <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-700" />
                    Publicación Simultánea en Redes Sociales (Facebook, Instagram, TikTok)
                  </span>
                  {(!hasFacebookCredentials && !hasInstagramCredentials && !hasTikTokCredentials) && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                      Credenciales incompletas en .env
                    </span>
                  )}
                </div>

                {editingPost && (editingPost.facebook_post_id || editingPost.instagram_post_id || editingPost.tiktok_post_id) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
                    {editingPost.facebook_post_id && (
                      <a
                        href={editingPost.facebook_post_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-100/70 hover:bg-blue-200/70 px-2.5 py-1 rounded-lg transition"
                      >
                        <ExternalLink size={12} />
                        Ver en Facebook
                      </a>
                    )}
                    {editingPost.instagram_post_id && (
                      <a
                        href={editingPost.instagram_post_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-700 bg-pink-100/70 hover:bg-pink-200/70 px-2.5 py-1 rounded-lg transition"
                      >
                        <ExternalLink size={12} />
                        Ver en Instagram
                      </a>
                    )}
                    {editingPost.tiktok_post_id && (
                      <a
                        href={editingPost.tiktok_post_id}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 bg-slate-200/80 hover:bg-slate-300/80 px-2.5 py-1 rounded-lg transition"
                      >
                        <ExternalLink size={12} />
                        Ver en TikTok
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={publishFacebook}
                      onChange={(e) => setPublishFacebook(e.target.checked)}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>Publicar en Facebook</span>
                    {editingPost?.facebook_post_id ? (
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                        ✓ Publicado en Facebook
                      </span>
                    ) : hasFacebookCredentials ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Configurado</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">(requiere credencial)</span>
                    )}
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={publishInstagram}
                      onChange={(e) => setPublishInstagram(e.target.checked)}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>Publicar en Instagram</span>
                    {editingPost?.instagram_post_id ? (
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                        ✓ Publicado en Instagram
                      </span>
                    ) : hasInstagramCredentials ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Configurado</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">(requiere credencial)</span>
                    )}
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={publishTikTok}
                      onChange={(e) => setPublishTikTok(e.target.checked)}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                    <span>Publicar en TikTok</span>
                    {editingPost?.tiktok_post_id ? (
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md font-bold">
                        ✓ Publicado en TikTok
                      </span>
                    ) : hasTikTokCredentials ? (
                      <span className="text-[10px] text-emerald-600 font-bold">✓ Configurado</span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">(requiere credencial / video)</span>
                    )}
                  </label>
                </div>
              </div>

              {/* Pie con Botones Guardar / Cancelar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-purple-950 hover:bg-slate-900 text-white text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {isPending ? "Guardando..." : editingPost ? "Actualizar Anuncio" : "Guardar y Publicar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
