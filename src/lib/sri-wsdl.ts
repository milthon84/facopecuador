/**
 * Cliente SOAP para los web services del SRI Ecuador.
 * No requiere librería soap externa — usa fetch nativo con envelopes manuales.
 */

// ── Endpoints ──────────────────────────────────────────────────────────────

const ENDPOINTS = {
  recepcion: {
    "1": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
    "2": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline",
  },
  autorizacion: {
    "1": "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
    "2": "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline",
  },
} as const;

// ── Tipos de respuesta ─────────────────────────────────────────────────────

export interface SriRecepcionResult {
  estado: "RECIBIDA" | "DEVUELTA";
  comprobantes?: Array<{
    claveAcceso: string;
    mensajes: Array<{ identificador: string; mensaje: string; informacionAdicional?: string; tipo: string }>;
  }>;
}

export interface SriAutorizacionResult {
  estado: "AUTORIZADO" | "NO AUTORIZADO" | "EN PROCESO";
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  ambiente?: string;
  mensajes?: Array<{ identificador: string; mensaje: string; informacionAdicional?: string; tipo: string }>;
}

// ── SOAP helpers ───────────────────────────────────────────────────────────

async function soapPost(url: string, body: string, soapAction: string): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/xml;charset=UTF-8",
  };
  // Solo incluir SOAPAction si no está vacío
  if (soapAction) headers["SOAPAction"] = soapAction;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(30_000),
  });
  return res.text();
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\/(?:[^:]+:)?${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([\\s\\S]*?)<\/(?:[^:]+:)?${tag}>`, "gi");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1].trim());
  return results;
}

// ── Recepción ──────────────────────────────────────────────────────────────

/**
 * Envía el XML firmado al SRI para recepción.
 * El XML debe ir codificado en Base64.
 */
export async function enviarComprobante(
  signedXml: string,
  ambiente: "1" | "2"
): Promise<SriRecepcionResult> {
  // Verificar que el XML no fue modificado después de firmar (debe tener <Signature>)
  if (!signedXml.includes("<Signature ") && !signedXml.includes("<ds:Signature ")) {
    throw new Error("El XML no contiene firma digital. El proceso de firma falló.");
  }
  // Log del XML firmado para diagnóstico (primeros 500 chars)
  console.log("=== XML FIRMADO (inicio) ===");
  console.log(signedXml.slice(0, 300));
  console.log("=== XML FIRMADO (fin) ===");
  console.log(signedXml.slice(-200));
  console.log("=== FIN XML ===");
  // Limpiar posible BOM invisible antes de la conversión a Base64 (Causa #1 AI)
  const cleanXml = signedXml.replace(/^\uFEFF/, '');
  const xmlBase64 = Buffer.from(cleanXml, "utf8").toString("base64");

  // Prefijo "rec" para recepción (igual que "aut" para autorización)
  // SOAPAction vacío — el SRI lee el Body directamente
  const envelope = [
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:rec="http://ec.gob.sri.ws.recepcion">`,
    `<soapenv:Header/>`,
    `<soapenv:Body>`,
    `<rec:validarComprobante>`,
    `<xml>${xmlBase64}</xml>`,
    `</rec:validarComprobante>`,
    `</soapenv:Body>`,
    `</soapenv:Envelope>`,
  ].join("");

  const responseXml = await soapPost(
    ENDPOINTS.recepcion[ambiente],
    envelope,
    "" // SOAPAction vacío
  );

  // Log completo para diagnóstico
  console.log("=== SRI RECEPCIÓN RESPONSE ===");
  console.log(responseXml.slice(0, 2000));
  console.log("=== END SRI RESPONSE ===");

  // Si la respuesta no contiene "estado", hubo error en la recepción
  const estadoRaw = extractTag(responseXml, "estado");
  if (!estadoRaw) {
    const faultString = extractTag(responseXml, "faultstring") || extractTag(responseXml, "faultString");
    const detail      = extractTag(responseXml, "detail") || extractTag(responseXml, "Detail");
    console.error("SRI Fault completo:", responseXml.slice(0, 3000));
    throw new Error(`SRI recepción no devolvió estado. ${faultString ? `Fault: ${faultString}` : `Response: ${responseXml.slice(0, 500)}`}${detail ? ` | Detail: ${detail.slice(0,200)}` : ""}`);
  }

  const estado = estadoRaw as "RECIBIDA" | "DEVUELTA";

  const comprobantesRaw = extractAllTags(responseXml, "comprobante");
  const comprobantes = comprobantesRaw.map((c) => ({
    claveAcceso: extractTag(c, "claveAcceso"),
    mensajes: extractAllTags(c, "mensaje").map((m) => ({
      identificador:       extractTag(m, "identificador"),
      mensaje:             extractTag(m, "mensaje"),
      informacionAdicional: extractTag(m, "informacionAdicional"),
      tipo:                extractTag(m, "tipo"),
    })),
  }));

  return { estado, comprobantes };
}

// ── Autorización ───────────────────────────────────────────────────────────

/**
 * Consulta el estado de autorización de un comprobante por clave de acceso.
 * Puede llamarse inmediatamente o en un retry posterior si el SRI responde "EN PROCESO".
 */
export async function consultarAutorizacion(
  claveAcceso: string,
  ambiente: "1" | "2"
): Promise<SriAutorizacionResult> {
  // Prefijo "aut" (no "ec") — requerido por el SRI Ecuador para autorización
  // SOAPAction vacío — evita conflictos con el endpoint del SRI
  const envelope = [
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:aut="http://ec.gob.sri.ws.autorizacion">`,
    `<soapenv:Header/>`,
    `<soapenv:Body>`,
    `<aut:autorizacionComprobante>`,
    `<claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>`,
    `</aut:autorizacionComprobante>`,
    `</soapenv:Body>`,
    `</soapenv:Envelope>`,
  ].join("");

  const responseXml = await soapPost(
    ENDPOINTS.autorizacion[ambiente],
    envelope,
    "" // SOAPAction vacío para autorización — el SRI lee el Body directamente
  );

  const autorizacionXml = extractTag(responseXml, "autorizacion");
  if (!autorizacionXml) {
    const numComp = extractTag(responseXml, "numeroComprobantes");
    if (numComp === "0") {
      return {
        estado: "NO AUTORIZADO",
        mensajes: [
          {
            identificador: "SRI-404",
            mensaje: "El comprobante no consta en el SRI (no fue recibido ni procesado).",
            tipo: "ERROR",
          },
        ],
      };
    }
    return { estado: "EN PROCESO" };
  }

  const estado = extractTag(autorizacionXml, "estado") as SriAutorizacionResult["estado"];
  const numeroAutorizacion = extractTag(autorizacionXml, "numeroAutorizacion");
  const fechaAutorizacion  = extractTag(autorizacionXml, "fechaAutorizacion");
  const ambienteResp       = extractTag(autorizacionXml, "ambiente");

  const mensajesRaw = extractAllTags(autorizacionXml, "mensaje");
  const mensajes = mensajesRaw.map((m) => ({
    identificador:       extractTag(m, "identificador"),
    mensaje:             extractTag(m, "mensaje"),
    informacionAdicional: extractTag(m, "informacionAdicional"),
    tipo:                extractTag(m, "tipo"),
  }));

  return {
    estado,
    numeroAutorizacion: numeroAutorizacion || undefined,
    fechaAutorizacion:  fechaAutorizacion  || undefined,
    ambiente:           ambienteResp       || undefined,
    mensajes:           mensajes.length > 0 ? mensajes : undefined,
  };
}

/**
 * Envía y espera autorización con un retry si el SRI responde "EN PROCESO".
 */
export async function enviarYAutorizar(
  signedXml: string,
  claveAcceso: string,
  ambiente: "1" | "2"
): Promise<{ recepcion: SriRecepcionResult; autorizacion: SriAutorizacionResult }> {
  const recepcion = await enviarComprobante(signedXml, ambiente);

  if (recepcion.estado === "DEVUELTA") {
    return { recepcion, autorizacion: { estado: "NO AUTORIZADO" } };
  }

  // Esperar 3s antes de la primera consulta
  await new Promise((r) => setTimeout(r, 3000));

  let autorizacion = await consultarAutorizacion(claveAcceso, ambiente);

  // Reintentar hasta 4 veces con 5s de espera si el SRI responde "EN PROCESO"
  const MAX_RETRIES = 4;
  let intentos = 0;
  while (autorizacion.estado === "EN PROCESO" && intentos < MAX_RETRIES) {
    await new Promise((r) => setTimeout(r, 5000));
    autorizacion = await consultarAutorizacion(claveAcceso, ambiente);
    intentos++;
  }

  return { recepcion, autorizacion };
}
