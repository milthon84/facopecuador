const SUPABASE_PUBLIC_MARKER = "/storage/v1/object/public/";
const SUPABASE_AUTH_MARKER = "/storage/v1/object/authenticated/";

/**
 * Convierte una URL de Supabase Storage en una ruta local cacheada en el servidor (/api/storage/...).
 * Esto evita que los navegadores de los visitantes descarguen imágenes y documentos directamente desde
 * el CDN de Supabase (eliminando el consumo de Cached Egress y evitando errores 404 por buckets privados).
 */
export function proxyStorageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/api/storage/")) return url;

  let idx = url.indexOf(SUPABASE_PUBLIC_MARKER);
  if (idx !== -1) {
    const bucketAndPath = url.slice(idx + SUPABASE_PUBLIC_MARKER.length);
    if (bucketAndPath) {
      return `/api/storage/${bucketAndPath}`;
    }
  }

  idx = url.indexOf(SUPABASE_AUTH_MARKER);
  if (idx !== -1) {
    const bucketAndPath = url.slice(idx + SUPABASE_AUTH_MARKER.length);
    if (bucketAndPath) {
      return `/api/storage/${bucketAndPath}`;
    }
  }

  return url;
}
