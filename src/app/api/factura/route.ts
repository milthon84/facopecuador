import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarClaveAcceso, generarXMLFactura, SRIInvoiceData, getTipoIdentificacion } from "@/lib/sri";
import { signXMLWithP12 } from "@/lib/sri-sign";
import { enviarYAutorizar } from "@/lib/sri-wsdl";
import { createInvoiceJournalEntry, assertMonthOpen } from "@/lib/accounting";
import crypto from "crypto";
import { getSessionUser } from "@/lib/supabase/auth";

/** Redondea un número a 2 decimales para evitar errores de punto flotante */
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    // Verificación de sesión y permisos
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Validar que el mes actual no se encuentre cerrado para contabilidad
    const todayStr = new Date().toISOString().split("T")[0];
    try {
      await assertMonthOpen(todayStr);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
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

    const body = await req.json();

    // 1. Obtener Configuración SRI
    const { data: config } = await supabase.from("sri_configs").select("*").single();
    if (!config) {
      return NextResponse.json({ error: "Configuración SRI no encontrada" }, { status: 400 });
    }

    // 2. Extraer datos del body
    const {
      patient_id, appointment_id, client_name, client_document, client_email, client_phone, client_address, items,
      payment_method = "efectivo", bank_account_id, payment_reference,
      card_type, card_lote, card_voucher,
      module_enrollment_ids,
      course_enrollment_id,
      full_course_payment,
    } = body;

    if (!client_name || !client_document || !items || items.length === 0) {
      return NextResponse.json({ error: "Faltan datos obligatorios: nombre, documento o ítems" }, { status: 400 });
    }

    // 3. Calcular totales con redondeo para evitar errores de punto flotante
    let invoiceItems = [...items];
    if (payment_method === "tarjeta_credito") {
      const surchargePercent = Number(config.card_surcharge_percent ?? 5.0);
      if (surchargePercent > 0) {
        const tempSub15 = items.filter((i: any) => i.iva_code === "4").reduce((acc: number, i: any) => acc + ((Number(i.quantity) * Number(i.unit_price)) - Number(i.discount || 0)), 0);
        const tempSub0  = items.filter((i: any) => i.iva_code === "0").reduce((acc: number, i: any) => acc + ((Number(i.quantity) * Number(i.unit_price)) - Number(i.discount || 0)), 0);
        const surchargeAmount = round2((tempSub15 + tempSub0) * (surchargePercent / 100));

        if (surchargeAmount > 0) {
          invoiceItems.push({
            code: "COM-TARJETA",
            description: `Recargo por Pago con Tarjeta (${surchargePercent}%)`,
            quantity: 1,
            unit_price: surchargeAmount,
            discount: 0,
            iva_code: "0",
            category: "Otros",
          });
        }
      }
    }

    let subtotal15 = 0;
    let subtotal0 = 0;

    const detalles: SRIInvoiceData["detalles"] = invoiceItems.map((item: any, index: number) => {
      const q = Number(item.quantity);
      const pu = Number(item.unit_price);
      const desc = round2(Number(item.discount || 0));
      const st = round2((q * pu) - desc);

      let ivaValor = 0;
      let tarifa = 0;
      let codigoPorcentaje = "0";

      if (item.iva_code === "4") { // 15% IVA
        tarifa = 15;
        ivaValor = round2(st * 0.15);
        subtotal15 = round2(subtotal15 + st);
        codigoPorcentaje = "4";
      } else { // 0% IVA
        subtotal0 = round2(subtotal0 + st);
      }

      return {
        codigoPrincipal: item.code || `ITEM-${index + 1}`,
        descripcion: item.description,
        cantidad: q,
        precioUnitario: pu,
        descuento: desc,
        precioTotalSinImpuesto: st,
        ivaCodigoPorcentaje: codigoPorcentaje,
        ivaTarifa: tarifa,
        ivaValor,
      };
    });

    const totalSinImpuestos = round2(subtotal15 + subtotal0);
    const iva15 = round2(subtotal15 * 0.15);
    const importeTotal = round2(totalSinImpuestos + iva15);
    const totalDescuento = round2(invoiceItems.reduce((acc: number, i: any) => acc + round2(Number(i.discount || 0)), 0));

    // 4. Generar Secuencial ATÓMICO usando la función de PostgreSQL (sin race condition)
    const { data: secData, error: secError } = await supabase.rpc("next_invoice_secuencial");
    if (secError) throw new Error(`Error generando secuencial: ${secError.message}`);

    const secuencial: number = secData;
    const secString = secuencial.toString().padStart(9, "0");
    const invoiceNumber = `${config.establecimiento}-${config.punto_emision}-${secString}`;

    // 5. Fechas y Códigos
    const now = new Date();
    const fechaEmision = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    const codigoNumerico = crypto.randomInt(10000000, 99999999).toString();

    // 6. Generar Clave de Acceso
    const claveAcceso = generarClaveAcceso({
      fechaEmision,
      tipoComprobante: "01",
      ruc: config.ruc,
      ambiente: config.ambiente as "1" | "2",
      establecimiento: config.establecimiento,
      puntoEmision: config.punto_emision,
      secuencial: secString,
      codigoNumerico,
      tipoEmision: "1",
    });

    // 7. Determinar tipo de identificación correctamente
    const tipoIdentificacionComprador = getTipoIdentificacion(client_document);

    // 8. Generar XML Base
    const invoiceData: SRIInvoiceData = {
      ambiente: config.ambiente as "1" | "2",
      tipoEmision: "1",
      razonSocial: config.razon_social,
      nombreComercial: config.nombre_comercial,
      ruc: config.ruc,
      claveAcceso,
      codDoc: "01",
      estab: config.establecimiento,
      ptoEmi: config.punto_emision,
      secuencial: secString,
      dirMatriz: config.direccion_matriz,
      fechaEmision,
      obligadoContabilidad: config.obligado_contabilidad ? "SI" : "NO",

      tipoIdentificacionComprador,
      razonSocialComprador: client_name,
      identificacionComprador: client_document,
      direccionComprador: client_address || "S/N",

      totalSinImpuestos,
      totalDescuento,

      subtotal15,
      iva15,
      subtotal0,
      subtotalNoObjeto: 0,
      subtotalExento: 0,
      propina: 0,
      importeTotal,
      moneda: "DOLAR",

      pagos: [{ formaPago: body.forma_pago || "01", total: importeTotal }],
      detalles,
      // infoAdicional omitido — campo opcional que puede causar problemas con caracteres en la DB del SRI
    };

    const xmlFactura = generarXMLFactura(invoiceData);

    // 9. Firmar y enviar al SRI
    // - Producción (ambiente=2): requiere certificado obligatoriamente
    // - Pruebas (ambiente=1): envía al SRI de pruebas si hay certificado, simula si no hay
    const tieneCertificado = !!(config.p12_storage_path && config.signature_password);
    const esProduccion     = config.ambiente === "2";
    const enviarAlSRI      = esProduccion || tieneCertificado; // pruebas con cert = real

    let sri_status: string = "authorized";
    let sri_authorization_number: string = claveAcceso;
    let sri_authorization_date: string   = new Date().toISOString();
    let sri_error_messages: object | null = null;
    let finalXmlToSave = xmlFactura;

    if (enviarAlSRI) {
      // Verificar certificado
      if (!config.p12_storage_path || !config.signature_password) {
        return NextResponse.json(
          { error: "Modo Producción requiere certificado .p12 configurado en Configuración SRI." },
          { status: 400 }
        );
      }

      // Descargar .p12 desde Supabase Storage
      const { data: p12Data, error: p12Error } = await supabase.storage
        .from("sri-certificates")
        .download(config.p12_storage_path);

      if (p12Error || !p12Data) {
        return NextResponse.json({ error: "No se pudo cargar el certificado .p12 desde storage." }, { status: 500 });
      }

      const p12Buffer = Buffer.from(await p12Data.arrayBuffer());

      // Firmar XML con XAdES-BES
      // .trim() elimina espacios/saltos de línea que se cuelan desde la DB
      const password = (config.signature_password || "").trim();
      if (!password) {
        return NextResponse.json({ error: "Contraseña del certificado no configurada." }, { status: 400 });
      }
      const xmlFirmado = signXMLWithP12(xmlFactura, p12Buffer, password);
      finalXmlToSave = xmlFirmado;

      // Enviar al SRI (pruebas: celcer.sri.gob.ec | producción: cel.sri.gob.ec)
      const { recepcion, autorizacion } = await enviarYAutorizar(
        xmlFirmado,
        claveAcceso,
        config.ambiente as "1" | "2"
      );

      if (recepcion.estado === "DEVUELTA") {
        sri_status = "rejected";
        sri_error_messages = recepcion.comprobantes?.[0]?.mensajes ?? null;
      } else if (autorizacion.estado === "AUTORIZADO") {
        sri_status = "authorized";
        sri_authorization_number = autorizacion.numeroAutorizacion ?? claveAcceso;
        sri_authorization_date   = autorizacion.fechaAutorizacion  ?? new Date().toISOString();
      } else if (autorizacion.estado === "NO AUTORIZADO") {
        sri_status = "rejected";
        sri_error_messages = autorizacion.mensajes ?? null;
      } else {
        sri_status = "submitted";
      }
    }
    // Si no hay certificado en modo pruebas → simular autorización (desarrollo local)

    // 10. Guardar Factura en Base de Datos
    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      patient_id: patient_id || null,
      xml_url: appointment_id || null,
      client_name,
      client_document,
      client_email: client_email || null,
      client_phone: client_phone || null,
      client_address: client_address || null,
      invoice_number: invoiceNumber,
      secuencial,
      subtotal_15: subtotal15,
      subtotal_0: subtotal0,
      iva_amount: iva15,
      total: importeTotal,
      total_discount: totalDescuento,
      sri_access_key: claveAcceso,
      sri_status,
      sri_authorization_number,
      sri_authorization_date,
      sri_environment: config.ambiente,
      payment_method:    payment_method    || null,
      bank_account_id:   bank_account_id   || null,
      payment_reference: payment_reference || null,
      card_type:         card_type         || null,
      card_lote:         card_lote         || null,
      card_voucher:      card_voucher      || null,
      ...(sri_error_messages ? { sri_error_messages } : {}),
    }).select().single();

    if (invoiceError) throw invoiceError;

    // 10. Guardar Ítems
    const itemsToInsert = detalles.map((d) => ({
      invoice_id: invoice.id,
      description: d.descripcion,
      quantity: d.cantidad,
      unit_price: d.precioUnitario,
      discount: d.descuento,
      iva_code: d.ivaCodigoPorcentaje,
      total: round2(d.precioTotalSinImpuesto + d.ivaValor),
    }));

    await supabase.from("invoice_items").insert(itemsToInsert);

    if (module_enrollment_ids && Array.isArray(module_enrollment_ids) && module_enrollment_ids.length > 0) {
      await supabase
        .from("curso_modulo_inscripciones")
        .update({
          invoice_id: invoice.id,
          billing_status: "invoiced",
          updated_at: new Date().toISOString()
        })
        .in("id", module_enrollment_ids);
    }

    if (course_enrollment_id) {
      await supabase
        .from("curso_inscripciones")
        .update({
          status: "enrolled",
          payment_type: full_course_payment ? "full_course" : "inscription",
          updated_at: new Date().toISOString()
        })
        .eq("id", course_enrollment_id);

      if (full_course_payment) {
        await supabase
          .from("curso_modulo_inscripciones")
          .update({
            invoice_id: invoice.id,
            billing_status: "invoiced",
            updated_at: new Date().toISOString()
          })
          .eq("enrollment_id", course_enrollment_id);
      }
    }

    // 12. Generar RIDE y enviar por correo si fue autorizado
    if (sri_status === "authorized") {
      try {
        const { generateRidePdf } = await import("@/lib/pdf-ride");
        const { sendInvoiceEmail } = await import("@/lib/email");

        const pdfBuffer = await generateRidePdf(invoiceData, {
          invoiceNumber,
          authorizationNumber: sri_authorization_number,
          authorizationDate: sri_authorization_date
        });
        
        const xmlBuffer = Buffer.from(finalXmlToSave, "utf-8");

        await sendInvoiceEmail(
          client_email,
          client_name,
          invoiceNumber,
          xmlBuffer,
          pdfBuffer
        );
      } catch (err) {
        console.error("Error al generar RIDE o enviar correo:", err);
      }
    }

    // 11. Registrar en bancos y contabilidad SOLO si la factura fue autorizada o enviada con éxito al SRI
    if (sri_status === "authorized" || sri_status === "submitted") {
      // Actualizar payment_status
      // Efectivo = cobrado inmediatamente; con cuenta bancaria = cobrado; resto = pendiente
      const isPaidImmediately = payment_method === "efectivo" || !!bank_account_id;
      try {
        await supabase.from("invoices").update({
          payment_status: isPaidImmediately ? "paid" : "pending",
        }).eq("id", invoice.id);
      } catch { /* columna aún no existe — ejecutar migration_cuentas_cobrar_pagar.sql */ }

      const today = new Date().toISOString().split("T")[0];

      if (bank_account_id) {
        // Transferencia/Tarjeta → registra en la cuenta bancaria seleccionada
        try {
          await supabase.from("bank_transactions").insert({
            account_id:     bank_account_id,
            type:           "ingreso",
            amount:         importeTotal,
            date:           today,
            description:    `Factura ${invoiceNumber} — ${client_name}`,
            reference:      payment_reference || claveAcceso.slice(-8),
            payment_method,
            invoice_id:     invoice.id,
            status:         "confirmado",
            origin:         "automatico",
            card_type:      card_type         || null,
            card_lote:      card_lote         || null,
            card_voucher:   card_voucher      || null,
          });
        } catch (bankErr) {
          console.error("Transacción bancaria no registrada:", bankErr);
        }
      } else if (payment_method === "efectivo") {
        // Efectivo → registra automáticamente en la Caja General
        try {
          const { data: cajaGeneral } = await supabase
            .from("bank_accounts")
            .select("id")
            .eq("is_caja_general", true)
            .eq("is_active", true)
            .maybeSingle();

          if (cajaGeneral) {
            await supabase.from("bank_transactions").insert({
              account_id:     cajaGeneral.id,
              type:           "ingreso",
              amount:         importeTotal,
              date:           today,
              description:    `Cobro efectivo Factura ${invoiceNumber} — ${client_name}`,
              payment_method: "efectivo",
              invoice_id:     invoice.id,
              status:         "confirmado",
              origin:         "automatico",
            });
          }
        } catch (cajaErr) {
          console.error("Registro Caja General no creado:", cajaErr);
        }
      }

      // 12. Generar asiento contable automático
      try {
        await createInvoiceJournalEntry({
          invoice_id:   invoice.id,
          invoice_date: new Date().toISOString().split("T")[0],
          client_name,
          subtotal_0:   subtotal0,
          subtotal_15:  subtotal15,
          iva_amount:   iva15,
          total:        importeTotal,
        });
      } catch (accErr) {
        console.error("Asiento contable no generado:", accErr);
      }
    }

    return NextResponse.json({
      success: true,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      clave_acceso: claveAcceso,
      xml: xmlFactura,
    });

  } catch (error: any) {
    console.error("Error en facturación:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
