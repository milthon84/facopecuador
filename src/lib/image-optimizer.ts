import sharp from "sharp";

interface OptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "jpeg";
}

/**
 * Optimiza y comprime una imagen en memoria para la web.
 * Reduce drásticamente el peso de afiches y fotos (de 8 MB a ~80-120 KB)
 * manteniendo excelente fidelidad visual y orientación EXIF correcta.
 */
export async function optimizeImageForWeb(
  inputBuffer: Buffer,
  options: OptimizeOptions = {}
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 80,
    format = "webp",
  } = options;

  let pipeline = sharp(inputBuffer).rotate();

  pipeline = pipeline.resize({
    width: maxWidth,
    height: maxHeight,
    fit: "inside",
    withoutEnlargement: true,
  });

  if (format === "webp") {
    const buffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  } else {
    const buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    return { buffer, contentType: "image/jpeg", extension: "jpg" };
  }
}
