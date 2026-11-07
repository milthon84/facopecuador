import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import { SRIInvoiceData, SRICreditNoteData } from "./sri";

export interface RideMetadata {
  invoiceNumber: string;
  authorizationNumber: string;
  authorizationDate: string;
}

export interface CreditNoteRideMetadata {
  creditNoteNumber: string;
  authorizationNumber: string;
  authorizationDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  motivo: string;
}

/**
 * Genera el RIDE (Representación Impresa del Documento Electrónico)
 * en formato PDF buffer utilizando pdfmake.
 */
export async function generateRidePdf(data: SRIInvoiceData, meta: RideMetadata): Promise<Buffer> {
  const pdfMake = require("pdfmake");
  const pdfMakeBuild = require("pdfmake/build/pdfmake.js");
  const pdfFonts = require("pdfmake/build/vfs_fonts.js");

  // Garantizar asignación del vfs (soporte webpack/Next.js)
  const vfsDict = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;
  pdfMake.vfs = vfsDict;
  pdfMakeBuild.vfs = vfsDict;

  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(vfsDict);
  }
  if (typeof pdfMakeBuild.addVirtualFileSystem === "function") {
    pdfMakeBuild.addVirtualFileSystem(vfsDict);
  }

  const fontsConfig = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf"
    }
  };
  pdfMake.fonts = fontsConfig;
  pdfMakeBuild.fonts = fontsConfig;

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  // Armar la tabla de detalles
  const tableBody: TableCell[][] = [
    [
      { text: "Cant", style: "tableHeader" },
      { text: "Descripción", style: "tableHeader" },
      { text: "Precio Unit", style: "tableHeader" },
      { text: "Descuento", style: "tableHeader" },
      { text: "Precio Total", style: "tableHeader" }
    ]
  ];

  data.detalles.forEach((d) => {
    tableBody.push([
      d.cantidad.toString(),
      d.descripcion,
      d.precioUnitario.toFixed(2),
      d.descuento.toFixed(2),
      d.precioTotalSinImpuesto.toFixed(2)
    ]);
  });

  const isProduction = data.ambiente === "2";

  const getFormaPagoText = (codigo: string) => {
    const metodos: Record<string, string> = {
      "01": "Sin utilización del sistema financiero",
      "15": "Compensación de deudas",
      "16": "Tarjeta de débito",
      "17": "Dinero electrónico",
      "18": "Tarjeta prepago",
      "19": "Tarjeta de crédito",
      "20": "Otros con utilización del sistema financiero",
      "21": "Endoso de títulos"
    };
    return metodos[codigo] || `Método ${codigo}`;
  };

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: {
      fontSize: 9
    },
    styles: {
      header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
      tableHeader: { bold: true, fillColor: "#eeeeee" },
      box: {
        margin: [0, 5, 0, 5]
      }
    },
    content: [
      {
        columns: [
          // Izquierda: Datos del Emisor
          {
            width: "50%",
            stack: [
              { text: data.razonSocial, style: "header" },
              ...(data.nombreComercial ? [{ text: data.nombreComercial, margin: [0, 0, 0, 5] as [number, number, number, number] }] : []),
              { text: `Dir Matriz: ${data.dirMatriz}` },
              { text: `Dir Establecimiento: ${data.dirMatriz}` },
              { text: `Obligado a llevar contabilidad: ${data.obligadoContabilidad}` },
            ]
          },
          // Derecha: Datos de la Factura y SRI
          {
            width: "50%",
            stack: [
              { text: "FACTURA", style: "header", alignment: "right" },
              { text: `No. ${meta.invoiceNumber}`, alignment: "right", fontSize: 12 },
              { text: `RUC: ${data.ruc}`, alignment: "right", bold: true, margin: [0, 5, 0, 0] },
              { text: `NÚMERO DE AUTORIZACIÓN:`, margin: [0, 10, 0, 0], fontSize: 8 },
              { text: meta.authorizationNumber, fontSize: 8 },
              { text: `FECHA Y HORA DE AUTORIZACIÓN: ${meta.authorizationDate}`, fontSize: 8, margin: [0, 5, 0, 0] },
              { text: `AMBIENTE: ${isProduction ? "PRODUCCIÓN" : "PRUEBAS"}`, fontSize: 8 },
              { text: `EMISIÓN: NORMAL`, fontSize: 8 },
              { text: `CLAVE DE ACCESO:`, margin: [0, 5, 0, 0], fontSize: 8 },
              { text: data.claveAcceso || "", fontSize: 8 }
            ]
          }
        ],
        columnGap: 20
      },
      // Separador
      { canvas: [{ type: "line", x1: 0, y1: 10, x2: 515, y2: 10, lineWidth: 1 }], margin: [0, 10, 0, 10] },
      
      // Datos del Cliente
      {
        stack: [
          { text: `Razón Social / Nombres y Apellidos: ${data.razonSocialComprador}` },
          { text: `Identificación: ${data.identificacionComprador}` },
          { text: `Fecha de Emisión: ${data.fechaEmision}` },
          { text: `Dirección: ${data.direccionComprador}` }
        ],
        margin: [0, 0, 0, 15]
      },

      // Tabla de Productos
      {
        table: {
          headerRows: 1,
          widths: ["auto", "*", "auto", "auto", "auto"],
          body: tableBody
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 15]
      },

      // Totales
      {
        columns: [
          // Info de pagos y adicionales
          {
            width: "60%",
            stack: [
              { text: "Forma de Pago", style: "subheader" },
              ...data.pagos.map(p => ({
                text: `• ${getFormaPagoText(p.formaPago)}: ${formatCurrency(p.total)}`
              }))
            ]
          },
          // Resumen de valores
          {
            width: "40%",
            table: {
              widths: ["*", "auto"],
              body: [
                ["SUBTOTAL 15%", formatCurrency(data.subtotal15)],
                ["SUBTOTAL 0%", formatCurrency(data.subtotal0)],
                ["SUBTOTAL No objeto de IVA", formatCurrency(data.subtotalNoObjeto)],
                ["SUBTOTAL Exento de IVA", formatCurrency(data.subtotalExento)],
                ["SUBTOTAL SIN IMPUESTOS", formatCurrency(data.totalSinImpuestos)],
                ["DESCUENTO", formatCurrency(data.totalDescuento)],
                ["IVA 15%", formatCurrency(data.iva15)],
                [{ text: "VALOR TOTAL", bold: true }, { text: formatCurrency(data.importeTotal), bold: true }]
              ]
            },
            layout: "lightHorizontalLines"
          }
        ]
      }
    ]
  };

  try {
    const pdfDoc = pdfMakeBuild.createPdf(docDefinition);
    const rawData = await pdfDoc.getBuffer();
    return Buffer.from(rawData);
  } catch (e) {
    throw e;
  }
}

/**
 * Genera el RIDE (Representación Impresa del Documento Electrónico)
 * para Nota de Crédito en formato PDF buffer utilizando pdfmake.
 */
export async function generateCreditNoteRidePdf(data: SRICreditNoteData, meta: CreditNoteRideMetadata): Promise<Buffer> {
  const pdfMake = require("pdfmake");
  const pdfMakeBuild = require("pdfmake/build/pdfmake.js");
  const pdfFonts = require("pdfmake/build/vfs_fonts.js");

  const vfsDict = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;
  pdfMake.vfs = vfsDict;
  pdfMakeBuild.vfs = vfsDict;

  if (typeof pdfMake.addVirtualFileSystem === "function") {
    pdfMake.addVirtualFileSystem(vfsDict);
  }
  if (typeof pdfMakeBuild.addVirtualFileSystem === "function") {
    pdfMakeBuild.addVirtualFileSystem(vfsDict);
  }

  const fontsConfig = {
    Roboto: {
      normal: "Roboto-Regular.ttf",
      bold: "Roboto-Medium.ttf",
      italics: "Roboto-Italic.ttf",
      bolditalics: "Roboto-MediumItalic.ttf"
    }
  };
  pdfMake.fonts = fontsConfig;
  pdfMakeBuild.fonts = fontsConfig;

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  const tableBody: TableCell[][] = [
    [
      { text: "Cant", style: "tableHeader" },
      { text: "Código", style: "tableHeader" },
      { text: "Descripción", style: "tableHeader" },
      { text: "Precio Unit", style: "tableHeader" },
      { text: "Descuento", style: "tableHeader" },
      { text: "Precio Total", style: "tableHeader" }
    ]
  ];

  data.detalles.forEach((d) => {
    tableBody.push([
      d.cantidad.toString(),
      d.codigoInterno || "",
      d.descripcion,
      d.precioUnitario.toFixed(2),
      (d.descuento || 0).toFixed(2),
      d.precioTotalSinImpuesto.toFixed(2)
    ]);
  });

  const isProduction = data.ambiente === "2";

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: {
      fontSize: 9
    },
    styles: {
      header: { fontSize: 16, bold: true, margin: [0, 0, 0, 5] },
      subheader: { fontSize: 11, bold: true, margin: [0, 8, 0, 4] },
      tableHeader: { bold: true, fillColor: "#eeeeee" },
      box: {
        margin: [0, 5, 0, 5]
      }
    },
    content: [
      {
        columns: [
          // Izquierda: Datos del Emisor
          {
            width: "50%",
            stack: [
              { text: data.razonSocial, style: "header" },
              ...(data.nombreComercial ? [{ text: data.nombreComercial, margin: [0, 0, 0, 5] as [number, number, number, number] }] : []),
              { text: `Dir Matriz: ${data.dirMatriz}` },
              { text: `Obligado a llevar contabilidad: ${data.obligadoContabilidad}` },
            ]
          },
          // Derecha: Datos de la Nota de Crédito y SRI
          {
            width: "50%",
            stack: [
              { text: "NOTA DE CRÉDITO", style: "header", alignment: "right", color: "#b91c1c" },
              { text: `No. ${meta.creditNoteNumber}`, alignment: "right", fontSize: 12, bold: true },
              { text: `RUC: ${data.ruc}`, alignment: "right", bold: true, margin: [0, 5, 0, 0] },
              { text: `NÚMERO DE AUTORIZACIÓN:`, margin: [0, 8, 0, 0], fontSize: 8 },
              { text: meta.authorizationNumber, fontSize: 8, bold: true },
              { text: `FECHA Y HORA DE AUTORIZACIÓN: ${meta.authorizationDate}`, fontSize: 8, margin: [0, 4, 0, 0] },
              { text: `AMBIENTE: ${isProduction ? "PRODUCCIÓN" : "PRUEBAS"}`, fontSize: 8 },
              { text: `EMISIÓN: NORMAL`, fontSize: 8 },
              { text: `CLAVE DE ACCESO:`, margin: [0, 4, 0, 0], fontSize: 8 },
              { text: data.claveAcceso || "", fontSize: 8 }
            ]
          }
        ],
        columnGap: 20
      },
      { canvas: [{ type: "line", x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1 }], margin: [0, 8, 0, 8] },

      // Datos del Cliente y Documento Modificado
      {
        columns: [
          {
            width: "55%",
            stack: [
              { text: `Razón Social: ${data.razonSocialComprador}`, bold: true },
              { text: `Identificación: ${data.identificacionComprador}` },
              { text: `Fecha de Emisión: ${data.fechaEmision}` },
            ]
          },
          {
            width: "45%",
            stack: [
              { text: `Comprobante Modificado: FACTURA ${meta.invoiceNumber}`, bold: true },
              { text: `Fecha Emisión Comprobante: ${meta.invoiceDate}` },
              { text: `Razón de Modificación: ${meta.motivo}`, italics: true },
            ]
          }
        ],
        margin: [0, 0, 0, 12]
      },

      // Tabla de Productos/Servicios
      {
        table: {
          headerRows: 1,
          widths: ["auto", "auto", "*", "auto", "auto", "auto"],
          body: tableBody
        },
        layout: "lightHorizontalLines",
        margin: [0, 0, 0, 15]
      },

      // Resumen de Totales
      {
        columns: [
          {
            width: "55%",
            stack: [
              { text: "Información Adicional", style: "subheader" },
              { text: `Documento que modifica: Factura N° ${meta.invoiceNumber}` },
              { text: `Motivo: ${meta.motivo}` },
            ]
          },
          {
            width: "45%",
            table: {
              widths: ["*", "auto"],
              body: [
                ["SUBTOTAL 15%", formatCurrency(data.subtotal15)],
                ["SUBTOTAL 0%", formatCurrency(data.subtotal0)],
                ["SUBTOTAL SIN IMPUESTOS", formatCurrency(data.totalSinImpuestos)],
                ["IVA 15%", formatCurrency(data.iva15)],
                [{ text: "VALOR TOTAL MODIFICACIÓN", bold: true }, { text: formatCurrency(data.valorModificacion), bold: true }]
              ]
            },
            layout: "lightHorizontalLines"
          }
        ]
      }
    ]
  };

  try {
    const pdfDoc = pdfMakeBuild.createPdf(docDefinition);
    const rawData = await pdfDoc.getBuffer();
    return Buffer.from(rawData);
  } catch (e) {
    throw e;
  }
}
