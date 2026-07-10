import { validateCedula, validateRUC } from "./validators";

export interface SRIInvoiceData {
  ambiente: "1" | "2"; // 1=Pruebas, 2=Produccion
  tipoEmision: "1"; // 1=Normal
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso?: string;
  codDoc: "01"; // 01=Factura
  estab: string; // ej. "001"
  ptoEmi: string; // ej. "001"
  secuencial: string; // ej. "000000001"
  dirMatriz: string;
  fechaEmision: string; // DD/MM/YYYY
  dirEstablecimiento?: string;
  obligadoContabilidad: "SI" | "NO";
  
  // Comprador
  tipoIdentificacionComprador: string; // 04=RUC, 05=Cedula, 06=Pasaporte, 07=Consumidor Final, 08=Id del exterior
  razonSocialComprador: string;
  identificacionComprador: string;
  direccionComprador?: string;
  
  // Totales
  totalSinImpuestos: number;
  totalDescuento: number;
  
  // Subtotales de Impuestos
  subtotal15: number;
  iva15: number;
  subtotal0: number;
  subtotalNoObjeto: number;
  subtotalExento: number;
  
  propina: number;
  importeTotal: number;
  moneda: "DOLAR";
  
  pagos: Array<{
    formaPago: string; // ej. "01" = Sin uso del sist financiero, "19" = Tarjeta Crédito, "20" = Otros
    total: number;
    plazo?: number;
    unidadTiempo?: string; // "dias", "meses"
  }>;

  detalles: Array<{
    codigoPrincipal: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotalSinImpuesto: number;
    ivaCodigoPorcentaje: string; // "0" = 0%, "4" = 15% (Ecuador actual), "2" = 12%
    ivaTarifa: number;
    ivaValor: number;
  }>;
  
  infoAdicional?: Record<string, string>;
}

/**
 * Genera el dígito verificador Módulo 11 para la clave de acceso del SRI
 */
export function generarDigitoModulo11(cadena48: string): string {
  let suma = 0;
  let factor = 2;
  
  for (let i = cadena48.length - 1; i >= 0; i--) {
    suma += parseInt(cadena48.charAt(i), 10) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  
  const digitoVerificador = 11 - (suma % 11);
  if (digitoVerificador === 11) return "0";
  if (digitoVerificador === 10) return "1";
  return digitoVerificador.toString();
}

/**
 * Genera la Clave de Acceso de 49 dígitos del SRI
 */
export function generarClaveAcceso(data: {
  fechaEmision: string; // Formato DD/MM/YYYY
  tipoComprobante: string; // "01" Factura
  ruc: string; // 13 digitos
  ambiente: "1" | "2"; // 1 Pruebas, 2 Prod
  establecimiento: string; // 3 digitos
  puntoEmision: string; // 3 digitos
  secuencial: string; // 9 digitos
  codigoNumerico: string; // 8 digitos (puede ser aleatorio o secuencia)
  tipoEmision: "1"; // 1 Normal
}): string {
  const fechaStr = data.fechaEmision.replace(/\//g, ""); // DDMMYYYY
  const ruc13 = data.ruc.padStart(13, "0");
  const estab = data.establecimiento.padStart(3, "0");
  const ptoEmi = data.puntoEmision.padStart(3, "0");
  const sec = data.secuencial.padStart(9, "0");
  const codigoNum = data.codigoNumerico.padStart(8, "0");

  const cadena48 = `${fechaStr}${data.tipoComprobante}${ruc13}${data.ambiente}${estab}${ptoEmi}${sec}${codigoNum}${data.tipoEmision}`;
  
  if (cadena48.length !== 48) {
    throw new Error(`La longitud de la cadena base para la clave de acceso no es 48. Longitud obtenida: ${cadena48.length}`);
  }

  const digito = generarDigitoModulo11(cadena48);
  return `${cadena48}${digito}`;
}

/** Normaliza caracteres para evitar corrupción de UTF-8 en los servidores del SRI */
function normalizeStr(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N");
}

/** Escapa caracteres especiales XML y normaliza para evitar errores de codificación */
function xe(s: string | undefined | null): string {
  if (!s) return "";
  const normalized = normalizeStr(String(s));
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Genera el XML en formato SRI (sin firma)
 */
export function generarXMLFactura(data: SRIInvoiceData): string {
  const formatNum = (num: number) => num.toFixed(2);
  const formatNum6 = (num: number) => num.toFixed(6); // Para precios unitarios si es necesario

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<factura id="comprobante" version="1.0.0">\n`;
  
  // infoTributaria
  xml += `  <infoTributaria>\n`;
  xml += `    <ambiente>${data.ambiente}</ambiente>\n`;
  xml += `    <tipoEmision>${data.tipoEmision}</tipoEmision>\n`;
  xml += `    <razonSocial>${xe(data.razonSocial)}</razonSocial>\n`;
  if (data.nombreComercial) {
    xml += `    <nombreComercial>${xe(data.nombreComercial)}</nombreComercial>\n`;
  }
  xml += `    <ruc>${data.ruc.padStart(13, "0")}</ruc>\n`;
  xml += `    <claveAcceso>${data.claveAcceso}</claveAcceso>\n`;
  xml += `    <codDoc>${data.codDoc}</codDoc>\n`;
  xml += `    <estab>${data.estab}</estab>\n`;
  xml += `    <ptoEmi>${data.ptoEmi}</ptoEmi>\n`;
  xml += `    <secuencial>${data.secuencial}</secuencial>\n`;
  xml += `    <dirMatriz>${xe(data.dirMatriz)}</dirMatriz>\n`;
  xml += `  </infoTributaria>\n`;

  // infoFactura
  xml += `  <infoFactura>\n`;
  xml += `    <fechaEmision>${data.fechaEmision}</fechaEmision>\n`;
  if (data.dirEstablecimiento) {
    xml += `    <dirEstablecimiento>${xe(data.dirEstablecimiento)}</dirEstablecimiento>\n`;
  }
  xml += `    <obligadoContabilidad>${data.obligadoContabilidad}</obligadoContabilidad>\n`;
  xml += `    <tipoIdentificacionComprador>${data.tipoIdentificacionComprador}</tipoIdentificacionComprador>\n`;
  xml += `    <razonSocialComprador>${xe(data.razonSocialComprador)}</razonSocialComprador>\n`;
  xml += `    <identificacionComprador>${data.identificacionComprador}</identificacionComprador>\n`;

  xml += `    <totalSinImpuestos>${formatNum(data.totalSinImpuestos)}</totalSinImpuestos>\n`;
  xml += `    <totalDescuento>${formatNum(data.totalDescuento)}</totalDescuento>\n`;
  
  // TotalConImpuestos
  xml += `    <totalConImpuestos>\n`;
  if (data.subtotal15 > 0) {
    xml += `      <totalImpuesto>\n`;
    xml += `        <codigo>2</codigo>\n`; // 2 = IVA
    xml += `        <codigoPorcentaje>4</codigoPorcentaje>\n`; // 4 = 15%
    xml += `        <baseImponible>${formatNum(data.subtotal15)}</baseImponible>\n`;
    xml += `        <valor>${formatNum(data.iva15)}</valor>\n`;
    xml += `      </totalImpuesto>\n`;
  }
  if (data.subtotal0 > 0) {
    xml += `      <totalImpuesto>\n`;
    xml += `        <codigo>2</codigo>\n`;
    xml += `        <codigoPorcentaje>0</codigoPorcentaje>\n`; // 0 = 0%
    xml += `        <baseImponible>${formatNum(data.subtotal0)}</baseImponible>\n`;
    xml += `        <valor>0.00</valor>\n`;
    xml += `      </totalImpuesto>\n`;
  }
  if (data.subtotalNoObjeto > 0) {
    xml += `      <totalImpuesto>\n`;
    xml += `        <codigo>2</codigo>\n`;
    xml += `        <codigoPorcentaje>6</codigoPorcentaje>\n`; // 6 = No objeto de IVA
    xml += `        <baseImponible>${formatNum(data.subtotalNoObjeto)}</baseImponible>\n`;
    xml += `        <valor>0.00</valor>\n`;
    xml += `      </totalImpuesto>\n`;
  }
  if (data.subtotalExento > 0) {
    xml += `      <totalImpuesto>\n`;
    xml += `        <codigo>2</codigo>\n`;
    xml += `        <codigoPorcentaje>7</codigoPorcentaje>\n`; // 7 = Exento de IVA
    xml += `        <baseImponible>${formatNum(data.subtotalExento)}</baseImponible>\n`;
    xml += `        <valor>0.00</valor>\n`;
    xml += `      </totalImpuesto>\n`;
  }
  xml += `    </totalConImpuestos>\n`;
  
  xml += `    <propina>${formatNum(data.propina)}</propina>\n`;
  xml += `    <importeTotal>${formatNum(data.importeTotal)}</importeTotal>\n`;
  xml += `    <moneda>${data.moneda}</moneda>\n`;
  
  // Pagos
  if (data.pagos && data.pagos.length > 0) {
    xml += `    <pagos>\n`;
    data.pagos.forEach(p => {
      xml += `      <pago>\n`;
      xml += `        <formaPago>${p.formaPago}</formaPago>\n`;
      xml += `        <total>${formatNum(p.total)}</total>\n`;
      if (p.plazo != null) xml += `        <plazo>${p.plazo}</plazo>\n`;
      if (p.unidadTiempo) xml += `        <unidadTiempo>${p.unidadTiempo}</unidadTiempo>\n`;
      xml += `      </pago>\n`;
    });
    xml += `    </pagos>\n`;
  }
  
  xml += `  </infoFactura>\n`;

  // Detalles
  xml += `  <detalles>\n`;
  data.detalles.forEach(d => {
    xml += `    <detalle>\n`;
    xml += `      <codigoPrincipal>${xe(d.codigoPrincipal)}</codigoPrincipal>\n`;
    xml += `      <descripcion>${xe(d.descripcion)}</descripcion>\n`;
    xml += `      <cantidad>${formatNum6(d.cantidad)}</cantidad>\n`;
    xml += `      <precioUnitario>${formatNum6(d.precioUnitario)}</precioUnitario>\n`;
    xml += `      <descuento>${formatNum(d.descuento)}</descuento>\n`;
    xml += `      <precioTotalSinImpuesto>${formatNum(d.precioTotalSinImpuesto)}</precioTotalSinImpuesto>\n`;
    xml += `      <impuestos>\n`;
    xml += `        <impuesto>\n`;
    xml += `          <codigo>2</codigo>\n`;
    xml += `          <codigoPorcentaje>${d.ivaCodigoPorcentaje}</codigoPorcentaje>\n`;
    xml += `          <tarifa>${d.ivaTarifa}</tarifa>\n`;
    xml += `          <baseImponible>${formatNum(d.precioTotalSinImpuesto)}</baseImponible>\n`;
    xml += `          <valor>${formatNum(d.ivaValor)}</valor>\n`;
    xml += `        </impuesto>\n`;
    xml += `      </impuestos>\n`;
    xml += `    </detalle>\n`;
  });
  xml += `  </detalles>\n`;

  // Info Adicional
  const infoAdic: Record<string, string> = { ...data.infoAdicional };
  if (data.direccionComprador && !infoAdic["Direccion"] && !infoAdic["Dirección"]) {
    infoAdic["Direccion"] = data.direccionComprador;
  }

  if (Object.keys(infoAdic).length > 0) {
    xml += `  <infoAdicional>\n`;
    Object.entries(infoAdic).forEach(([key, val]) => {
      xml += `    <campoAdicional nombre="${xe(key)}">${xe(val)}</campoAdicional>\n`;
    });
    xml += `  </infoAdicional>\n`;
  }

  xml += `</factura>`;

  // ── Minificar: eliminar saltos de línea y espacios de indentación ──────────
  // El SRI requiere XML sin whitespace entre tags para que la firma no se rompa.
  // El parser Java del SRI normaliza el whitespace al re-serializar, causando
  // diferencias en el hash si el XML está indentado.
  return xml
    .replace(/\n\s*/g, "")    // eliminar newlines y la indentación que sigue
    .replace(/>\s+</g, "><"); // eliminar espacios entre tags (por si quedan)
}

/**
 * Determina el tipo de identificación del comprador según las reglas del SRI Ecuador:
 *  04 = RUC (13 dígitos terminados en 001 y válidos)
 *  05 = Cédula de identidad (10 dígitos válidos)
 *  06 = Pasaporte
 *  07 = Consumidor Final (9999999999999)
 *  08 = Identificación del exterior
 */
export function getTipoIdentificacion(doc: string): string {
  const d = doc.trim();
  if (d === "9999999999999") return "07"; // Consumidor Final
  
  const cleanDoc = d.replace(/[\s\-]/g, "");
  if (cleanDoc.length === 13 && validateRUC(cleanDoc)) return "04"; // RUC
  if (cleanDoc.length === 10 && validateCedula(cleanDoc)) return "05"; // Cédula
  
  // Si no es cédula o RUC ecuatoriano válido, se asume Pasaporte (06) para pacientes extranjeros.
  return "06";
}
