import fs from "fs";
import path from "path";
import os from "os";

export const ALLOWED_STORAGE_BUCKETS = new Set([
  "web-assets",
  "course-banners",
  "payment-proofs",
  "invoice-photos",
  "patient-photos",
]);

function getBaseCacheDir(): string {
  const projectCacheDir = path.join(process.cwd(), ".next", "cache", "supabase-storage");
  try {
    fs.mkdirSync(projectCacheDir, { recursive: true });
    return projectCacheDir;
  } catch {
    const tmpCacheDir = path.join(os.tmpdir(), "facop-supabase-storage");
    fs.mkdirSync(tmpCacheDir, { recursive: true });
    return tmpCacheDir;
  }
}

export function resolveSafeCacheFilePath(bucket: string, segments: string[]): string | null {
  if (!ALLOWED_STORAGE_BUCKETS.has(bucket)) return null;
  if (!segments || segments.length === 0) return null;

  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..") || seg.includes("\\")) {
      return null;
    }
  }

  const baseDir = getBaseCacheDir();
  const resolved = path.resolve(baseDir, bucket, ...segments);
  const bucketRoot = path.resolve(baseDir, bucket);

  if (!resolved.startsWith(bucketRoot + path.sep)) {
    return null;
  }

  return resolved;
}

/**
 * Guarda de forma proactiva un archivo recién subido en el caché de disco local del servidor.
 * Así ni siquiera la primera visita al archivo consumirá Egress de Supabase.
 */
export async function warmLocalStorageCache(
  bucket: string,
  storagePath: string,
  buffer: Buffer
): Promise<void> {
  try {
    const segments = storagePath.split("/").filter(Boolean);
    const cacheFilePath = resolveSafeCacheFilePath(bucket, segments);
    if (!cacheFilePath) return;

    await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
    const tempPath = `${cacheFilePath}.${Date.now()}.tmp`;
    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, cacheFilePath);
  } catch (err) {
    // Fallo silencioso: si el disco local no permite escritura, el proxy hará fallback normal
    console.warn("No se pudo pre-calentar caché local de storage:", err);
  }
}

export function getMimeTypeFromFilename(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mov":
      return "video/quicktime";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
