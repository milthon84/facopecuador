import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import {
  ALLOWED_STORAGE_BUCKETS,
  resolveSafeCacheFilePath,
  getMimeTypeFromFilename,
} from "@/lib/storage-cache-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Mapa global en memoria para deduplicar descargas simultáneas del mismo archivo
const inFlightDownloads = new Map<string, Promise<Buffer | null>>();

async function fetchFileBufferFromSupabase(
  bucket: string,
  segments: string[]
): Promise<Buffer | null> {
  const filePath = segments.join("/");

  // 1. Intentar descargar mediante cliente Admin (bypassa RLS, funciona en buckets privados y públicos)
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (!error && data) {
      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Si no se encontró en la ruta con subcarpeta, intentar en la raíz por si acaso
    if (segments.length > 1) {
      const fileNameOnly = segments[segments.length - 1];
      const { data: rootData, error: rootErr } = await supabase.storage
        .from(bucket)
        .download(fileNameOnly);
      if (!rootErr && rootData) {
        const arrayBuffer = await rootData.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    }
  } catch (adminErr) {
    console.warn(`[storage-proxy] Error con createAdminClient para ${bucket}/${filePath}:`, adminErr);
  }

  // 2. Intentar fetch directo con cabecera de autenticación si existe
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const authHeaders: Record<string, string> = {};
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (serviceKey) {
    authHeaders["apikey"] = serviceKey;
    authHeaders["Authorization"] = `Bearer ${serviceKey}`;
  } else if (anonKey) {
    authHeaders["apikey"] = anonKey;
    authHeaders["Authorization"] = `Bearer ${anonKey}`;
  }

  const encodedPath = segments.map((s) => encodeURIComponent(s)).join("/");
  const candidateUrls = [
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`,
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`,
  ];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        headers: authHeaders,
        cache: "no-store",
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch {
      // Intentar la siguiente URL
    }
  }

  return null;
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

  // 1. Si ya está en disco local, verificar y servir desde el caché de disco
  if (cacheFilePath) {
    try {
      const stat = await fs.promises.stat(cacheFilePath);
      if (stat.isFile() && stat.size > 0) {
        return serveFileFromDisk(request, cacheFilePath, stat);
      }
    } catch {
      // No está en disco todavía
    }
  }

  // 2. Descargar con deduplicación de descargas simultáneas
  const cacheKey = `${bucket}/${fileSegments.join("/")}`;
  let downloadPromise = inFlightDownloads.get(cacheKey);

  if (!downloadPromise) {
    downloadPromise = (async () => {
      try {
        const buffer = await fetchFileBufferFromSupabase(bucket, fileSegments);
        if (buffer && cacheFilePath) {
          // Guardar en disco en segundo plano; no abortar si falla por permisos de disco
          (async () => {
            try {
              await fs.promises.mkdir(path.dirname(cacheFilePath), { recursive: true });
              const tempPath = `${cacheFilePath}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
              await fs.promises.writeFile(tempPath, buffer);
              await fs.promises.rename(tempPath, cacheFilePath);
            } catch (saveErr) {
              console.warn(`[storage-proxy] No se pudo guardar en disco local (${cacheKey}):`, saveErr);
            }
          })();
        }
        return buffer;
      } finally {
        inFlightDownloads.delete(cacheKey);
      }
    })();
    inFlightDownloads.set(cacheKey, downloadPromise);
  }

  const fileBuffer = await downloadPromise;
  if (!fileBuffer) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  // 3. Servir el buffer directamente
  const fileName = fileSegments[fileSegments.length - 1] || "archivo";
  const contentType = getMimeTypeFromFilename(fileName);
  const etag = `W/"${fileBuffer.length}-${encodeURIComponent(fileSegments.join("/"))}"`;

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(fileBuffer.length),
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    ETag: etag,
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
  };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304, headers });
  }

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers,
  });
}

function serveFileFromDisk(request: NextRequest, cacheFilePath: string, stat: fs.Stats) {
  const fileSize = stat.size;
  const contentType = getMimeTypeFromFilename(cacheFilePath);
  const fileName = path.basename(cacheFilePath);
  const etag = `W/"${fileSize}-${encodeURIComponent(fileName)}"`;

  const CommonHeaders: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Accept-Ranges": "bytes",
    ETag: etag,
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
  };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag && !request.headers.get("range")) {
    return new NextResponse(null, {
      status: 304,
      headers: CommonHeaders,
    });
  }

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
