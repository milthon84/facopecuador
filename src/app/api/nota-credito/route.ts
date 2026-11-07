import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generarClaveAcceso,
  generarXMLNotaCredito,
  SRICreditNoteData,
  getTipoIdentificacion,
} from "@/lib/sri";
import { signXMLWithP12 } from "@/lib/sri-sign";
import { enviarYAutorizar } from "@/lib/sri-wsdl";
import { createCreditNoteJournalEntry, assertMonthOpen } from "@/lib/accounting";
import crypto from "crypto";
import { getSessionUser } from "@/lib/supabase/auth";
import { logAudit } from "@/lib/audit";

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoice_id");

    let query = supabase
      .from("credit_notes")
      .select("*, invoices(invoice_number, client_name)")
      .order("created_at", { ascending: false });

    if (invoiceId) {
      query = query.eq("invoice_id", invoiceId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error("Error consultando notas de crédito:", err);
    return NextResponse.json({ error: err.message || "Error al consultar notas de crédito" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    // 1. Verificación de sesión y permisos
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    if (role !== "admin") {
      const { data } = await supabase
        .from("role_permissions")
        .select("path")
        .eq("role_name", role);
      const paths = (data || []).map((p: any) => p.path);
      if (!paths.includes("/erp/facturacion/modificar")) {
        return NextResponse.json({ error: "Sin permisos de facturación" }, { status: 403 });
      }
    }

    // 2. Extraer datos del body
    const body = await req.json();
    const {
      invoice_id,
      motivo = "Anulación de comprobante de venta",
      items, // Si se omite, se anula la factura completa (100%)
    } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "ID de factura obligatorio" }, { status: 400 });
    }

    // Validar período contable
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      await assertMonthOpen(todayStr);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    // 3. Obtener la Factura original y sus ítems
    const [{ data: invoice }, { data: invoiceItems }, { data: config }] = await Promise.all([
      supabase.from("invoices").select("*").eq("id", invoice_id).single(),
      supabase.from("invoice_items").select("*").eq("invoice_id", invoice_id),
      supabase.from("sri_configs").select("*").single(),
    ]);

    if (!invoice) {
      return NextResponse.json({ error: "Factura original no encontrada" }, { status: 404 });
    }
    if (!config) {
      return NextResponse.json({ error: "Configuración SRI no encontrada" }, { status: 400 });
    }
    if (!invoice.invoice_number) {
      return NextResponse.json(
        { error: "La factura no posee número asignado (es un borrador o no se generó)." },
        { status: 400 }
      );
    }

    // Comprobar si ya existe una Nota de Crédito autorizada para esta factura
    const { data: existingCn } = await supabase
      .from("credit_notes")
      .select("id, credit_note_number, sri_status")
      .eq("invoice_id", invoice_id)
      .eq("sri_status", "authorized")
      .maybeSingle();

    if (existingCn) {
      return NextResponse.json(
        {
          error: `Ya existe una Nota de Crédito autorizada (${existingCn.credit_note_number}) para esta factura.`,
        },
        { status: 400 }
      );
    }

    // 4. Determinar los ítems a reversar
    const rawItemsToProcess = (items && items.length > 0) ? items : invoiceItems;
    if (!rawItemsToProcess || rawItemsToProcess.length === 0) {
      return NextResponse.json({ error: "No hay ítems para incluir en la Nota de Crédito" }, { status: 400 });
    }

    let subtotal15 = 0;
    let subtotal0 = 0;
    let totalDescuento = 0;

    const detallesParaSri: SRICreditNoteData["detalles"] = rawItemsToProcess.map((item: any, idx: number) => {
      const q = Number(item.quantity || 1);
      const pu = Number(item.unit_price || 0);
      const desc = round2(Number(item.discount || 0));
      const st = round2(q * pu - desc);

      let tarifa = 0;
      let ivaValor = 0;
      let codigoPorcentaje = "0";

      if (item.iva_code === "4") {
        tarifa = 15;
        ivaValor = round2(st * 0.15);
        subtotal15 = round2(subtotal15 + st);
        codigoPorcentaje = "4";
      } else {
        subtotal0 = round2(subtotal0 + st);
      }

      totalDescuento = round2(totalDescuento + desc);

      return {
        codigoInterno: item.code || item.id?.slice(0, 10) || `ITEM-${idx + 1}`,
        descripcion: item.description || "Servicio",
        cantidad: q,
        precioUnitario: pu,
        descuento: desc > 0 ? desc : undefined,
        precioTotalSinImpuesto: st,
        ivaCodigoPorcentaje: codigoPorcentaje,
        ivaTarifa: tarifa,
        ivaValor,
      };
    });

    const totalSinImpuestos = round2(subtotal15 + subtotal0);
    const iva15 = round2(subtotal15 * 0.15);
    const valorModificacion = round2(totalSinImpuestos + iva15);

    // 5. Generar Secuencial para Nota de Crédito
    let secuencial = 1;
    try {
      const { data: secData, error: secError } = await supabase.rpc("next_credit_note_secuencial");
      if (!secError && secData) {
        secuencial = Number(secData);
      } else {
        throw new Error(secError?.message || "Sin RPC de secuencia");
      }
    } catch {
      // Fallback seguro en DB
      const { data: maxRow } = await supabase
        .from("credit_notes")
        .select("secuencial")
        .order("secuencial", { ascending: false })
        .limit(1)
        .maybeSingle();
      secuencial = (maxRow?.secuencial || 0) + 1;
    }

    const secString = secuencial.toString().padStart(9, "0");
    const creditNoteNumber = `${config.establecimiento}-${config.punto_emision}-${secString}`;

    // 6. Fechas y Códigos
    const now = new Date();
    const fechaEmision = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    const codigoNumerico = crypto.randomInt(10000000, 99999999).toString();

    // Fecha de emisión de la factura original en formato DD/MM/YYYY
    let fechaDocSustento = fechaEmision;
    if (invoice.issue_date) {
      const [y, m, d] = invoice.issue_date.split("-");
      if (y && m && d) fechaDocSustento = `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    } else if (invoice.created_at) {
      const dObj = new Date(invoice.created_at);
      fechaDocSustento = `${dObj.getDate().toString().padStart(2, "0")}/${(dObj.getMonth() + 1).toString().padStart(2, "0")}/${dObj.getFullYear()}`;
    }

    // 7. Generar Clave de Acceso (codDoc: "04" = Nota de Crédito)
    const claveAcceso = generarClaveAcceso({
      fechaEmision,
      tipoComprobante: "04",
      ruc: config.ruc,
      ambiente: config.ambiente as "1" | "2",
      establecimiento: config.establecimiento,
      puntoEmision: config.punto_emision,
      secuencial: secString,
      codigoNumerico,
      tipoEmision: "1",
    });

    const tipoIdentificacionComprador = getTipoIdentificacion(invoice.client_document);

    // 8. Generar XML Nota de Crédito
    const creditNoteData: SRICreditNoteData = {
      ambiente: config.ambiente as "1" | "2",
      tipoEmision: "1",
      razonSocial: config.razon_social,
      nombreComercial: config.nombre_comercial,
      ruc: config.ruc,
      claveAcceso,
      codDoc: "04",
      estab: config.establecimiento,
      ptoEmi: config.punto_emision,
      secuencial: secString,
      dirMatriz: config.direccion_matriz,
      fechaEmision,
      obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO",

      tipoIdentificacionComprador,
      razonSocialComprador: invoice.client_name,
      identificacionComprador: invoice.client_document,

      codDocModificado: "01",
      numDocModificado: invoice.invoice_number,
      fechaEmisionDocSustento: fechaDocSustento,
      totalSinImpuestos,
      valorModificacion,
      moneda: "DOLAR",
      motivo,

      subtotal15,
      iva15,
      subtotal0,
      subtotalNoObjeto: 0,
      subtotalExento: 0,

      detalles: detallesParaSri,
      infoAdicional: invoice.client_address ? { Direccion: invoice.client_address } : undefined,
    };

    const xmlNotaCredito = generarXMLNotaCredito(creditNoteData);

    // 9. Firmar y Enviar al SRI
    const tieneCertificado = !!(config.p12_storage_path && config.signature_password);
    const esProduccion = config.ambiente === "2";
    const enviarAlSRI = esProduccion || tieneCertificado;

    let sri_status: string = "authorized";
    let sri_authorization_number: string = claveAcceso;
    let sri_authorization_date: string = new Date().toISOString();
    let sri_error_messages: any = null;
    let finalXml = xmlNotaCredito;

    if (enviarAlSRI) {
      if (!config.p12_storage_path || !config.signature_password) {
        return NextResponse.json(
          { error: "Certificado digital .p12 no configurado para emitir al SRI." },
          { status: 400 }
        );
      }

      // Descargar .p12
      const { data: p12Data, error: p12Error } = await supabase.storage
        .from("sri-certificates")
        .download(config.p12_storage_path);

      if (p12Error || !p12Data) {
        return NextResponse.json({ error: "No se pudo cargar el certificado .p12 desde storage." }, { status: 500 });
      }

      const p12Buffer = Buffer.from(await p12Data.arrayBuffer());
      const password = (config.signature_password || "").trim();
      const xmlFirmado = signXMLWithP12(xmlNotaCredito, p12Buffer, password);
      finalXml = xmlFirmado;

      try {
        console.log(`Enviando Nota de Crédito ${creditNoteNumber} (Clave: ${claveAcceso}) al SRI...`);
        const resSri = await enviarYAutorizar(xmlFirmado, claveAcceso, config.ambiente as "1" | "2");
        const aut = resSri.autorizacion;

        if (aut.estado === "AUTORIZADO") {
          sri_status = "authorized";
          sri_authorization_number = aut.numeroAutorizacion || claveAcceso;
          sri_authorization_date = aut.fechaAutorizacion || new Date().toISOString();
        } else if (aut.estado === "EN PROCESO") {
          sri_status = "submitted";
          sri_error_messages = aut.mensajes || null;
        } else {
          sri_status = "rejected";
          sri_error_messages = aut.mensajes || (resSri.recepcion?.comprobantes?.[0]?.mensajes) || null;
        }
      } catch (err: any) {
        console.error("Error comunicando con SRI para Nota de Crédito:", err);
        sri_status = "error";
        sri_error_messages = [{ mensaje: err.message || "Error de conexión SOAP con el SRI" }];
      }
    }

    // 10. Guardar la Nota de Crédito en la Base de Datos
    const { data: insertedCn, error: insertCnError } = await supabase
      .from("credit_notes")
      .insert({
        invoice_id,
        credit_note_number: creditNoteNumber,
        secuencial,
        issue_date: todayStr,
        client_name: invoice.client_name,
        client_document: invoice.client_document,
        client_email: invoice.client_email,
        client_phone: invoice.client_phone,
        client_address: invoice.client_address,
        cod_doc_modificado: "01",
        num_doc_modificado: invoice.invoice_number,
        fecha_emision_doc_sustento: fechaDocSustento,
        motivo,
        subtotal_15: subtotal15,
        subtotal_0: subtotal0,
        subtotal_no_iva: 0,
        subtotal_exento: 0,
        total_discount: totalDescuento,
        iva_rate: 15,
        iva_amount: iva15,
        total: valorModificacion,
        sri_access_key: claveAcceso,
        sri_status,
        sri_environment: config.ambiente,
        sri_authorization_number,
        sri_authorization_date,
        sri_error_messages,
      })
      .select()
      .single();

    if (insertCnError) {
      console.error("Error guardando nota de crédito:", insertCnError);
      throw new Error(`Error al registrar nota de crédito: ${insertCnError.message}`);
    }

    // Insertar ítems de la nota de crédito
    if (insertedCn && rawItemsToProcess.length > 0) {
      const itemsToInsert = rawItemsToProcess.map((it: any) => ({
        credit_note_id: insertedCn.id,
        code: it.code || null,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount || 0,
        iva_code: it.iva_code || "4",
        total: round2(Number(it.quantity) * Number(it.unit_price) - Number(it.discount || 0)),
      }));

      await supabase.from("credit_note_items").insert(itemsToInsert);
    }

    // 11. Si la Nota de Crédito fue AUTORIZADA por el SRI:
    if (sri_status === "authorized") {
      // Actualizar factura original
      const existingMsg = (invoice.sri_error_messages as Record<string, any>) || {};
      await supabase
        .from("invoices")
        .update({
          payment_status: "cancelled",
          sri_error_messages: {
            ...existingMsg,
            credit_note: {
              credit_note_id: insertedCn.id,
              credit_note_number: creditNoteNumber,
              motivo,
              authorized_at: sri_authorization_date,
            },
          },
        })
        .eq("id", invoice_id);

      // Asiento contable de reversión en el Libro Diario
      try {
        await createCreditNoteJournalEntry({
          credit_note_id: insertedCn.id,
          credit_note_number: creditNoteNumber,
          credit_note_date: todayStr,
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
          subtotal_0: subtotal0,
          subtotal_15: subtotal15,
          iva_amount: iva15,
          total: valorModificacion,
          motivo,
          user_id: user.id,
          user_email: user.email,
        });
      } catch (accErr) {
        console.warn("Advertencia: No se pudo generar asiento de reversión automática:", accErr);
      }
    }

    // 12. Auditoría
    await logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: role as any,
      action: "create",
      resource: "credit_note",
      resource_id: insertedCn.id,
      description: `Emisión de Nota de Crédito ${creditNoteNumber} sobre Factura ${invoice.invoice_number} (Estado SRI: ${sri_status})`,
      metadata: {
        credit_note_number: creditNoteNumber,
        invoice_id,
        invoice_number: invoice.invoice_number,
        total: valorModificacion,
        sri_status,
        claveAcceso,
      },
    });

    return NextResponse.json({
      success: true,
      credit_note_id: insertedCn.id,
      credit_note_number: creditNoteNumber,
      clave_acceso: claveAcceso,
      sri_status,
      sri_authorization_number,
      sri_error_messages,
      message:
        sri_status === "authorized"
          ? `Nota de Crédito ${creditNoteNumber} AUTORIZADA por el SRI con éxito.`
          : sri_status === "submitted"
          ? `Nota de Crédito ${creditNoteNumber} enviada al SRI (en proceso).`
          : `Nota de Crédito ${creditNoteNumber} generada con estado: ${sri_status}.`,
    });
  } catch (err: any) {
    console.error("Error en POST /api/nota-credito:", err);
    return NextResponse.json({ error: err.message || "Error procesando Nota de Crédito" }, { status: 500 });
  }
}
