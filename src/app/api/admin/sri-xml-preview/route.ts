import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarXMLFactura, generarClaveAcceso, getTipoIdentificacion } from "@/lib/sri";
import crypto from "crypto";

/**
 * Genera el XML de una factura SIN firmar para inspección.
 * POST /api/admin/sri-xml-preview { invoice_id }
 */
export async function POST(req: Request) {
  try {
    const { invoice_id } = await req.json();
    const supabase = createAdminClient();

    const [{ data: invoice }, { data: items }, { data: config }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoice_id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoice_id),
      supabase.from("sri_configs").select("*").single(),
    ]);

    if (!invoice || !config) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const issueDate  = new Date(invoice.created_at);
    const fechaEmision = `${issueDate.getDate().toString().padStart(2,"0")}/${(issueDate.getMonth()+1).toString().padStart(2,"0")}/${issueDate.getFullYear()}`;

    const secuencial = invoice.secuencial?.toString().padStart(9, "0") ?? "000000001";
    const codigoNumerico = crypto.randomInt(10000000, 99999999).toString();

    const claveAcceso = generarClaveAcceso({
      fechaEmision,
      tipoComprobante: "01",
      ruc: config.ruc,
      ambiente: config.ambiente as "1"|"2",
      establecimiento: config.establecimiento,
      puntoEmision: config.punto_emision,
      secuencial,
      codigoNumerico,
      tipoEmision: "1",
    });

    const detalles = (items || []).map((item: any) => ({
      codigoPrincipal: item.description?.slice(0,25) ?? "ITEM",
      descripcion: item.description ?? "",
      text: undefined,
      cantidad: Number(item.quantity),
      precioUnitario: Number(item.unit_price),
      descuento: Number(item.discount || 0),
      precioTotalSinImpuesto: Number(item.quantity) * Number(item.unit_price) - Number(item.discount || 0),
      ivaCodigoPorcentaje: item.iva_code === "4" ? "4" : "0",
      ivaTarifa: item.iva_code === "4" ? 15 : 0,
      ivaValor: item.iva_code === "4" ? Math.round(Number(item.quantity) * Number(item.unit_price) * 0.15 * 100) / 100 : 0,
    }));

    const xmlData = {
      ambiente: config.ambiente as "1"|"2",
      tipoEmision: "1" as "1",
      razonSocial: config.razon_social,
      nombreComercial: config.nombre_comercial,
      ruc: config.ruc,
      claveAcceso,
      codDoc: "01" as "01",
      estab: config.establecimiento,
      ptoEmi: config.punto_emision,
      secuencial,
      dirMatriz: config.direccion_matriz,
      fechaEmision,
      obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO" as "SI"|"NO",
      tipoIdentificacionComprador: getTipoIdentificacion(invoice.client_document),
      razonSocialComprador: invoice.client_name,
      identificacionComprador: invoice.client_document,
      direccionComprador: invoice.client_address || undefined,
      totalSinImpuestos: Number(invoice.subtotal_15) + Number(invoice.subtotal_0),
      totalDescuento: Number(invoice.total_discount || 0),
      subtotal15: Number(invoice.subtotal_15),
      iva15: Number(invoice.iva_amount),
      subtotal0: Number(invoice.subtotal_0),
      subtotalNoObjeto: 0,
      subtotalExento: 0,
      propina: 0,
      importeTotal: Number(invoice.total),
      moneda: "DOLAR" as "DOLAR",
      pagos: [{ formaPago: "01", total: Number(invoice.total) }],
      detalles,
      infoAdicional: invoice.client_email ? { Email: invoice.client_email } : undefined,
    };

    const xml = generarXMLFactura(xmlData);

    return NextResponse.json({
      invoice_number: invoice.invoice_number,
      ambiente: config.ambiente === "1" ? "PRUEBAS" : "PRODUCCIÓN",
      ruc_config: config.ruc,
      ruc_xml: config.ruc,
      clave_acceso: claveAcceso,
      xml_preview: xml,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
