import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRidePdf, RideMetadata } from "@/lib/pdf-ride";
import { SRIInvoiceData, getTipoIdentificacion } from "@/lib/sri";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID de factura no proporcionado." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const [{ data: invoice }, { data: items }, { data: sriConfig }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id"),
      supabase.from("sri_configs").select("*").maybeSingle(),
    ]);

    if (!invoice) {
      return NextResponse.json({ error: "Factura no encontrada." }, { status: 404 });
    }

    const config = sriConfig || {
      razon_social: "FACOP ECUADOR",
      nombre_comercial: "FACOP ECUADOR",
      ruc: "1790000000001",
      establecimiento: "001",
      punto_emision: "001",
      direccion_matriz: "Quito, Ecuador",
      obligado_contabilidad: false,
      ambiente: invoice.sri_environment || "1",
    };

    const fechaEmision = invoice.created_at
      ? new Date(invoice.created_at).toLocaleDateString("es-EC", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : new Date().toLocaleDateString("es-EC", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });

    const detalles = (items || []).map((item: any) => {
      const q = Number(item.quantity || 1);
      const price = Number(item.unit_price || 0);
      const discount = Number(item.discount || 0);
      const totalSinImp = q * price - discount;
      return {
        codigoPrincipal: item.id || "001",
        descripcion: item.description || "Servicio",
        cantidad: q,
        precioUnitario: price,
        descuento: discount,
        precioTotalSinImpuesto: totalSinImp,
        ivaCodigoPorcentaje: item.iva_code || "4",
        ivaTarifa: item.iva_code === "4" ? 15 : 0,
        ivaValor: item.iva_code === "4" ? totalSinImp * 0.15 : 0,
      };
    });

    const sriData: SRIInvoiceData = {
      ambiente: (invoice.sri_environment || config.ambiente || "1") as "1" | "2",
      tipoEmision: "1",
      razonSocial: config.razon_social || "FACOP ECUADOR",
      nombreComercial: config.nombre_comercial || "FACOP ECUADOR",
      ruc: config.ruc || "1790000000001",
      claveAcceso: invoice.sri_access_key || "",
      codDoc: "01",
      estab: config.establecimiento || "001",
      ptoEmi: config.punto_emision || "001",
      secuencial: invoice.secuencial || "000000001",
      dirMatriz: config.direccion_matriz || "Quito, Ecuador",
      fechaEmision,
      obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO",
      tipoIdentificacionComprador: getTipoIdentificacion(invoice.client_document || ""),
      razonSocialComprador: invoice.client_name || "Cliente",
      identificacionComprador: invoice.client_document || "9999999999999",
      direccionComprador: invoice.client_address || "Quito, Ecuador",
      totalSinImpuestos: Number(invoice.subtotal_15 || 0) + Number(invoice.subtotal_0 || 0),
      totalDescuento: Number(invoice.total_discount || 0),
      subtotal15: Number(invoice.subtotal_15 || 0),
      iva15: Number(invoice.iva_amount || 0),
      subtotal0: Number(invoice.subtotal_0 || 0),
      subtotalNoObjeto: 0,
      subtotalExento: 0,
      propina: 0,
      importeTotal: Number(invoice.total || 0),
      moneda: "DOLAR",
      pagos: [{ formaPago: invoice.payment_method || "01", total: Number(invoice.total || 0) }],
      detalles,
    };

    const meta: RideMetadata = {
      invoiceNumber: invoice.invoice_number || "001-001-000000001",
      authorizationNumber: invoice.sri_authorization_number || invoice.sri_access_key || "SIN-AUTORIZACION",
      authorizationDate: invoice.sri_authorization_date
        ? new Date(invoice.sri_authorization_date).toLocaleString("es-EC")
        : new Date().toLocaleString("es-EC"),
    };

    const pdfBuffer = await generateRidePdf(sriData, meta);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Factura_${invoice.invoice_number || 'SRI'}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("Error al generar PDF de la factura:", err);
    return NextResponse.json({ error: "Error al generar el documento impreso." }, { status: 500 });
  }
}
