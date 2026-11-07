/**
 * Firma digital XAdES-BES para comprobantes electrónicos SRI Ecuador.
 * Implementación custom con todos los fixes aplicados:
 * - XML minificado (sin whitespace)
 * - Sin CDATA
 * - URI="#comprobante" (elemento raíz con id="comprobante")
 * - Transforms: enveloped-signature + C14N
 * - docDigest sin declaración XML (URI apunta al elemento, no al documento)
 * - Prefijo ds: para XMLDSig
 * - QualifyingProperties dentro de ds:Object (no en factura directamente)
 */

import forge from "node-forge";
import { createHash } from "crypto";

// ── Utilidades ─────────────────────────────────────────────────────────────

function sha1b64(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return createHash("sha1").update(buf).digest("base64");
}

function nowEcuador(): string {
  const now   = new Date();
  const local = new Date(now.getTime() + (-5 * 60) * 60000);
  return local.toISOString().replace("Z", "-05:00");
}

// ── Información del certificado ────────────────────────────────────────────

export interface CertInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
}

export function parseCertInfo(p12Buffer: Buffer, password: string): CertInfo {
  const p12Asn1  = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString("binary")));
  const p12      = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const cert     = certBags[forge.pki.oids.certBag]?.[0]?.cert;
  if (!cert) throw new Error("No se encontró certificado en el archivo .p12");

  const subject  = cert.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
  const issuer   = cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", ");
  const allAttrs = cert.subject.attributes.map((a: any) => String(a.value || "")).join(" ");

  return {
    subject: subject + " | ALL:" + allAttrs,
    issuer,
    serialNumber: parseInt(cert.serialNumber, 16).toString(),
    validFrom: (cert.validity.notBefore as Date).toISOString().split("T")[0],
    validTo:   (cert.validity.notAfter  as Date).toISOString().split("T")[0],
  };
}

// ── Firma XAdES-BES ────────────────────────────────────────────────────────

export function signXMLWithP12(xmlString: string, p12Buffer: Buffer, password: string): string {
  const DS    = "http://www.w3.org/2000/09/xmldsig#";
  const XADES = "http://uri.etsi.org/01903/v1.3.2#";
  const C14N  = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

  // ── 1. Interceptar el parseo para capturar el ASN.1 original del certificado ──
  const originalCertFromAsn1 = forge.pki.certificateFromAsn1;
  let rawCertAsn1: any = null;
  forge.pki.certificateFromAsn1 = function(obj: any, computeHash?: boolean) {
    if (!rawCertAsn1) rawCertAsn1 = obj;
    return originalCertFromAsn1.apply(this, arguments as any);
  };

  let p12: any;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString("binary")));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (e: any) {
    forge.pki.certificateFromAsn1 = originalCertFromAsn1;
    throw new Error(`Contraseña del certificado incorrecta: ${e.message}`);
  }
  forge.pki.certificateFromAsn1 = originalCertFromAsn1;

  const privateKey = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    [forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key as forge.pki.rsa.PrivateKey | undefined;
  const cert = p12.getBags({ bagType: forge.pki.oids.certBag })
    [forge.pki.oids.certBag]?.[0]?.cert;

  if (!privateKey) throw new Error("No se encontró clave privada en el .p12.");
  if (!cert)       throw new Error("No se encontró certificado en el .p12.");

  // ── 2. Datos del certificado ─────────────────────────────────────────────
  // Usamos el ASN.1 capturado para preservar los bytes originales exactamente
  const certDer      = forge.asn1.toDer(rawCertAsn1).bytes();
  const certBase64   = forge.util.encode64(certDer);
  const certDigest   = sha1b64(Buffer.from(certDer, "binary"));
  const issuerName   = cert.issuer.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(",");
  const serialNumber = BigInt("0x" + cert.serialNumber).toString(10);
  const signingTime  = nowEcuador();

  // Para KeyValue, necesitamos extraer el módulo y exponente.
  // Como cert.publicKey.n es un BigInteger, lo pasamos a Hex -> Bytes -> Base64
  let hexModulus = cert.publicKey.n.toString(16);
  if (hexModulus.length % 2 !== 0) hexModulus = "0" + hexModulus;
  const modulus = forge.util.encode64(forge.util.hexToBytes(hexModulus));

  let hexExponent = cert.publicKey.e.toString(16);
  if (hexExponent.length % 2 !== 0) hexExponent = "0" + hexExponent;
  const exponent = forge.util.encode64(forge.util.hexToBytes(hexExponent));

  // ── 3. SignedProperties (C14N) ───────────────────────────────────────────
  const signedPropsC14n = [
    `<etsi:SignedProperties xmlns:ds="${DS}" xmlns:etsi="${XADES}" Id="Signature-SignedProperties">`,
    `<etsi:SignedSignatureProperties>`,
    `<etsi:SigningTime>${signingTime}</etsi:SigningTime>`,
    `<etsi:SigningCertificate>`,
    `<etsi:Cert>`,
    `<etsi:CertDigest>`,
    `<ds:DigestMethod Algorithm="${DS}sha1"></ds:DigestMethod>`,
    `<ds:DigestValue>${certDigest}</ds:DigestValue>`,
    `</etsi:CertDigest>`,
    `<etsi:IssuerSerial>`,
    `<ds:X509IssuerName>${issuerName}</ds:X509IssuerName>`,
    `<ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>`,
    `</etsi:IssuerSerial>`,
    `</etsi:Cert>`,
    `</etsi:SigningCertificate>`,
    `</etsi:SignedSignatureProperties>`,
    `<etsi:SignedDataObjectProperties>`,
    `<etsi:DataObjectFormat ObjectReference="#Signature-Reference-comprobante">`,
    `<etsi:Description>contenido comprobante</etsi:Description>`,
    `<etsi:MimeType>text/xml</etsi:MimeType>`,
    `</etsi:DataObjectFormat>`,
    `</etsi:SignedDataObjectProperties>`,
    `</etsi:SignedProperties>`,
  ].join("");

  const signedPropsDigest = sha1b64(signedPropsC14n);
  const signedPropsXml = signedPropsC14n;

  // ── 4. Document digest ───────────────────────────────────────────────────
  // Para que C14N coincida perfectamente, no debe haber saltos de línea sueltos
  // antes del tag raíz. El regex remueve la declaración XML y cualquier espacio/salto posterior.
  const xmlSinDeclaracion = xmlString.replace(/^<\?xml[^?]*\?>\s*/, "");
  const docDigest = sha1b64(xmlSinDeclaracion);

  // ── 5. SignedInfo SIN xmlns:ds explícito en el XML final ─────────────────
  const signedInfoXml = [
    `<ds:SignedInfo xmlns:ds="${DS}" xmlns:etsi="${XADES}" Id="Signature-SignedInfo">`,
    `<ds:CanonicalizationMethod Algorithm="${C14N}"></ds:CanonicalizationMethod>`,
    `<ds:SignatureMethod Algorithm="${DS}rsa-sha1"></ds:SignatureMethod>`,
    `<ds:Reference Id="Signature-Reference-SignedProperties" Type="http://uri.etsi.org/01903#SignedProperties" URI="#Signature-SignedProperties">`,
    `<ds:Transforms><ds:Transform Algorithm="${C14N}"></ds:Transform></ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${DS}sha1"></ds:DigestMethod>`,
    `<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `<ds:Reference Id="Signature-Reference-comprobante" URI="#comprobante">`,
    `<ds:Transforms>`,
    `<ds:Transform Algorithm="${DS}enveloped-signature"></ds:Transform>`,
    `<ds:Transform Algorithm="${C14N}"></ds:Transform>`,
    `</ds:Transforms>`,
    `<ds:DigestMethod Algorithm="${DS}sha1"></ds:DigestMethod>`,
    `<ds:DigestValue>${docDigest}</ds:DigestValue>`,
    `</ds:Reference>`,
    `</ds:SignedInfo>`,
  ].join("");

  // ── 6. Firmar SignedInfo con RSA-SHA1 ────────────────────────────────────
  const md = forge.md.sha1.create();
  md.update(signedInfoXml, "utf8");
  const signatureBase64 = forge.util.encode64(privateKey.sign(md));

  // ── 7. Ensamblar Signature completa ──────────────────────────────────────
  const signatureXml = [
    `<ds:Signature xmlns:ds="${DS}" xmlns:etsi="${XADES}" Id="Signature">`,
    signedInfoXml,
    `<ds:SignatureValue Id="SignatureValue">${signatureBase64}</ds:SignatureValue>`,
    `<ds:KeyInfo Id="Certificate">`,
    `<ds:X509Data><ds:X509Certificate>${certBase64}</ds:X509Certificate></ds:X509Data>`,
    `<ds:KeyValue>`,
    `<ds:RSAKeyValue>`,
    `<ds:Modulus>${modulus}</ds:Modulus>`,
    `<ds:Exponent>${exponent}</ds:Exponent>`,
    `</ds:RSAKeyValue>`,
    `</ds:KeyValue>`,
    `</ds:KeyInfo>`,
    `<ds:Object Id="QualifyingProperties">`,
    `<etsi:QualifyingProperties xmlns:etsi="${XADES}" Target="#Signature">`,
    signedPropsXml,
    `</etsi:QualifyingProperties>`,
    `</ds:Object>`,
    `</ds:Signature>`,
  ].join("");

  // ── 8. Insertar Signature antes del cierre del comprobante ────────────────
  return xmlString.replace(/(<\/(?:factura|notaCredito|notaDebito|guiaRemision|comprobanteRetencion)>\s*)$/i, `${signatureXml}$1`);
}
