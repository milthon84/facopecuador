const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/";

/**
 * Convierte una URL pública de Supabase Storage en una ruta local cacheada en el servidor (/api/storage/...).
 * Esto evita que los navegadores de los visitantes descarguen imágenes y videos directamente desde
 * el CDN de Supabase (eliminando el consumo de Cached Egress en Supabase).
 */
export function proxyStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const idx = url.indexOf(SUPABASE_PUBLIC_MARKER);
  if (idx !== -1) {
    const bucketAndPath = url.slice(idx + SUPABASE_PUBLIC_MARKER.length);
    if (bucketAndPath) {
      return `/api/storage/${bucketAndPath}`;
    }
  }
  return url;
}
