import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCreditNoteRidePdf, CreditNoteRideMetadata } from "@/lib/pdf-ride";
import { SRICreditNoteData, getTipoIdentificacion } from "@/lib/sri";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID de nota de crédito no proporcionado." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const [{ data: creditNote }, { data: items }, { data: sriConfig }] = await Promise.all([
      supabase.from("credit_notes").select("*").eq("id", id).single(),
      supabase.from("credit_note_items").select("*").eq("credit_note_id", id).order("id"),
      supabase.from("sri_configs").select("*").maybeSingle(),
    ]);

    if (!creditNote) {
      return NextResponse.json({ error: "Nota de crédito no encontrada." }, { status: 404 });
    }

    const config = sriConfig || {
      razon_social: "FACOP ECUADOR",
      nombre_comercial: "FACOP ECUADOR",
      ruc: "1790000000001",
      establecimiento: "001",
      punto_emision: "001",
      direccion_matriz: "Quito, Ecuador",
      obligado_contabilidad: false,
      ambiente: creditNote.sri_environment || "1",
    };

    const fechaEmision = creditNote.created_at
      ? new Date(creditNote.created_at).toLocaleDateString("es-EC", {
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
        codigoInterno: item.code || item.id?.slice(0, 8) || "001",
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

    const creditNoteData: SRICreditNoteData = {
      ambiente: (creditNote.sri_environment as "1" | "2") || (config.ambiente as "1" | "2") || "1",
      tipoEmision: "1",
      razonSocial: config.razon_social,
      nombreComercial: config.nombre_comercial,
      ruc: config.ruc,
      claveAcceso: creditNote.sri_access_key,
      codDoc: "04",
      estab: config.establecimiento,
      ptoEmi: config.punto_emision,
      secuencial: creditNote.secuencial?.toString().padStart(9, "0") || "000000001",
      dirMatriz: config.direccion_matriz,
      fechaEmision,
      obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO",

      tipoIdentificacionComprador: getTipoIdentificacion(creditNote.client_document),
      razonSocialComprador: creditNote.client_name,
      identificacionComprador: creditNote.client_document,

      codDocModificado: "01",
      numDocModificado: creditNote.num_doc_modificado,
      fechaEmisionDocSustento: creditNote.fecha_emision_doc_sustento || fechaEmision,
      totalSinImpuestos: Number(creditNote.subtotal_15 || 0) + Number(creditNote.subtotal_0 || 0),
      valorModificacion: Number(creditNote.total || 0),
      moneda: "DOLAR",
      motivo: creditNote.motivo || "Anulación de comprobante",

      subtotal15: Number(creditNote.subtotal_15 || 0),
      iva15: Number(creditNote.iva_amount || 0),
      subtotal0: Number(creditNote.subtotal_0 || 0),
      subtotalNoObjeto: 0,
      subtotalExento: 0,

      detalles,
    };

    const meta: CreditNoteRideMetadata = {
      creditNoteNumber: creditNote.credit_note_number || "Borrador",
      authorizationNumber: creditNote.sri_authorization_number || creditNote.sri_access_key || "Pendiente",
      authorizationDate: creditNote.sri_authorization_date
        ? new Date(creditNote.sri_authorization_date).toLocaleString("es-EC")
        : "Pendiente",
      invoiceNumber: creditNote.num_doc_modificado,
      invoiceDate: creditNote.fecha_emision_doc_sustento || "--",
      motivo: creditNote.motivo || "Anulación de venta",
    };

    const pdfBuffer = await generateCreditNoteRidePdf(creditNoteData, meta);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="RIDE_NC_${creditNote.credit_note_number || "NC"}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error generando PDF RIDE de Nota de Crédito:", error);
    return NextResponse.json({ error: error.message || "Error al generar RIDE PDF" }, { status: 500 });
  }
}
