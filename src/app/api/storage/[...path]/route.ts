import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import {
  ALLOWED_STORAGE_BUCKETS,
  resolveSafeCacheFilePath,
  getMimeTypeFromFilename,
} from "@/lib/storage-cache-server";

// Mapa global en memoria para deduplicar descargas simultáneas del mismo archivo
const inFlightDownloads = new Map<string, Promise<boolean>>();

async function ensureFileCached(
  bucket: string,
  segments: string[],
  cacheFilePath: string
): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(cacheFilePath);
    if (stat.isFile() && stat.size > 0) {
      return true;
    }
  } catch {
    // El archivo aún no existe en disco local
  }

  const cacheKey = `${bucket}/${segments.join("/")}`;
  const existingPromise = inFlightDownloads.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  const downloadPromise = (async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) return false;

      const encodedPath = segments.map((s) => encodeURIComponent(s)).join("/");
      const remoteUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(
        bucket
      )}/${encodedPath}`;

      const response = await fetch(remoteUrl, {
        cache: "no-store",
      });

      if (!response.ok) {
        return false;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
      const tempPath = `${cacheFilePath}.${Date.now()}.${Math.random()
        .toString(36)
        .slice(2, 7)}.tmp`;
      await fs.promises.writeFile(tempPath, buffer);
      await fs.promises.rename(tempPath, cacheFilePath);
      return true;
    } catch (err) {
      console.error(`Error al cachear archivo desde Supabase (${cacheKey}):`, err);
      return false;
    } finally {
      inFlightDownloads.delete(cacheKey);
    }
  })();

  inFlightDownloads.set(cacheKey, downloadPromise);
  return downloadPromise;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  if (!pathSegments || pathSegments.length < 2) {
    return new NextResponse("Ruta de archivo no válida", { status: 400 });
  }

  const [bucket, ...fileSegments] = pathSegments;
  if (!ALLOWED_STORAGE_BUCKETS.has(bucket)) {
    return new NextResponse("Bucket no permitido", { status: 403 });
  }

  const cacheFilePath = resolveSafeCacheFilePath(bucket, fileSegments);
  if (!cacheFilePath) {
    return new NextResponse("Ruta no permitida", { status: 400 });
  }

  const isCached = await ensureFileCached(bucket, fileSegments, cacheFilePath);
  if (!isCached) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(cacheFilePath);
  } catch {
    return new NextResponse("Archivo no disponible", { status: 404 });
  }

  const fileSize = stat.size;
  const contentType = getMimeTypeFromFilename(cacheFilePath);
  const etag = `W/"${fileSize}-${encodeURIComponent(fileSegments.join("/"))}"`;

  const CommonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Accept-Ranges": "bytes",
    ETag: etag,
  };

  // Soporte de validación condicional 304 Not Modified (0 bytes transferidos)
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag && !request.headers.get("range")) {
    return new NextResponse(null, {
      status: 304,
      headers: CommonHeaders,
    });
  }

  // Soporte de peticiones parciales HTTP 206 Range (indispensable para streaming de video MP4/WebM)
  const rangeHeader = request.headers.get("range");
  if (rangeHeader && fileSize > 0) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const startStr = match[1];
      const endStr = match[2];

      let start = startStr ? parseInt(startStr, 10) : 0;
      let end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= fileSize) end = fileSize - 1;

      if (start >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            ...CommonHeaders,
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(cacheFilePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          ...CommonHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunkSize),
        },
      });
    }
  }

  const nodeStream = fs.createReadStream(cacheFilePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...CommonHeaders,
      "Content-Length": String(fileSize),
    },
  });
}
