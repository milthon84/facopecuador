import type { TDocumentDefinitions, TableCell } from "pdfmake/interfaces";

export interface ClinicSummaryMetrics {
  totalAppointments: number;
  scheduledAppointments: number;
  attendedAppointments: number;
  totalBilled: number;
  formattedTotalBilled: string;
  totalExpenses: number;
  formattedTotalExpenses: string;
}

export interface DoctorSummaryRow {
  name: string;
  specialty: string;
  total: number;
  attended: number;
  formattedBilled: string;
}

export interface CourseSummaryMetrics {
  activeCoursesCount: number;
  totalStudents: number;
  totalBilled: number;
  formattedTotalBilled: string;
  totalExpenses: number;
  formattedTotalExpenses: string;
}

export interface CourseSummaryRow {
  name: string;
  statusLabel: string;
  dates: string;
  students: number;
  formattedBilled: string;
}

export interface ExecutiveSummaryPdfData {
  periodLabel: string;
  clinicMetrics: ClinicSummaryMetrics;
  doctorRows: DoctorSummaryRow[];
  courseMetrics: CourseSummaryMetrics;
  courseRows: CourseSummaryRow[];
  generatedAt?: string;
}

/**
 * Genera el documento PDF de Resumen Ejecutivo (Clínica + Cursos) en 1 sola página.
 */
export async function generateExecutiveSummaryPdf(data: ExecutiveSummaryPdfData): Promise<Buffer> {
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
      bolditalics: "Roboto-MediumItalic.ttf",
    },
  };
  pdfMake.fonts = fontsConfig;
  pdfMakeBuild.fonts = fontsConfig;

  // 1. Tabla de Doctores
  const doctorTableBody: TableCell[][] = [
    [
      { text: "DOCTOR / ODONTÓLOGO", style: "tableHeader", alignment: "left" },
      { text: "CITAS", style: "tableHeader", alignment: "center" },
      { text: "ATENCIONES", style: "tableHeader", alignment: "center" },
      { text: "TOTAL FACTURADO", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (data.doctorRows.length === 0) {
    doctorTableBody.push([
      { text: "No se registraron citas ni atenciones en este período.", colSpan: 4, style: "tableEmpty", alignment: "center" },
      {},
      {},
      {},
    ]);
  } else {
    data.doctorRows.forEach((doc, idx) => {
      const isEven = idx % 2 === 0;
      doctorTableBody.push([
        {
          stack: [
            { text: doc.name, bold: true, fontSize: 8.5, color: "#1e1b4b" },
            { text: doc.specialty || "Odontología", fontSize: 7, color: "#64748b" },
          ],
          fillColor: isEven ? "#faf5ff" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
        {
          text: doc.total.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8.5,
          fillColor: isEven ? "#faf5ff" : "#ffffff",
          margin: [0, 2, 0, 0],
        },
        {
          text: doc.attended.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8.5,
          color: "#059669",
          fillColor: isEven ? "#faf5ff" : "#ffffff",
          margin: [0, 2, 0, 0],
        },
        {
          text: doc.formattedBilled,
          alignment: "right",
          bold: true,
          fontSize: 8.5,
          color: "#0f172a",
          fillColor: isEven ? "#faf5ff" : "#ffffff",
          margin: [0, 2, 0, 0],
        },
      ]);
    });
  }

  // 2. Tabla de Cursos
  const courseTableBody: TableCell[][] = [
    [
      { text: "CURSO", style: "tableHeader", alignment: "left" },
      { text: "ESTADO", style: "tableHeader", alignment: "center" },
      { text: "FECHAS", style: "tableHeader", alignment: "center" },
      { text: "ALUMNOS", style: "tableHeader", alignment: "center" },
      { text: "TOTAL FACTURADO", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (data.courseRows.length === 0) {
    courseTableBody.push([
      { text: "No se registran cursos activos en este período.", colSpan: 5, style: "tableEmpty", alignment: "center" },
      {},
      {},
      {},
      {},
    ]);
  } else {
    data.courseRows.forEach((c, idx) => {
      const isEven = idx % 2 === 0;
      courseTableBody.push([
        {
          text: c.name,
          bold: true,
          fontSize: 8,
          color: "#1e1b4b",
          fillColor: isEven ? "#f8fafc" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
        {
          text: c.statusLabel,
          alignment: "center",
          fontSize: 7.5,
          color: "#475569",
          fillColor: isEven ? "#f8fafc" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
        {
          text: c.dates,
          alignment: "center",
          fontSize: 7.5,
          color: "#475569",
          fillColor: isEven ? "#f8fafc" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
        {
          text: c.students.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8,
          color: "#1e1b4b",
          fillColor: isEven ? "#f8fafc" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
        {
          text: c.formattedBilled,
          alignment: "right",
          bold: true,
          fontSize: 8,
          color: "#0f172a",
          fillColor: isEven ? "#f8fafc" : "#ffffff",
          margin: [0, 1, 0, 1],
        },
      ]);
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [24, 20, 24, 20],
    content: [
      // Encabezado Principal
      {
        columns: [
          {
            stack: [
              { text: "FACOP ECUADOR", fontSize: 15, bold: true, color: "#6b21a8" },
              { text: "Reporte Ejecutivo", fontSize: 10, bold: true, color: "#334155" },
            ],
            width: "*",
          },
          {
            stack: [
              { text: "PERÍODO", fontSize: 7.5, bold: true, color: "#94a3b8", alignment: "right" },
              { text: data.periodLabel, fontSize: 10, bold: true, color: "#1e293b", alignment: "right" },
            ],
            width: "auto",
          },
        ],
        margin: [0, 0, 0, 8],
      },

      // SECCIÓN 1: CLÍNICA
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "CLÍNICA",
                fontSize: 9.5,
                bold: true,
                color: "#581c87",
                fillColor: "#f3e8ff",
                margin: [4, 2, 4, 2],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 4],
      },

      // 4 KPIs Clínica (Tabla de 4 columnas)
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "CITAS TOTALES", fontSize: 7, bold: true, color: "#64748b" },
                  { text: data.clinicMetrics.totalAppointments.toString(), fontSize: 13, bold: true, color: "#0f172a" },
                  { text: `${data.clinicMetrics.scheduledAppointments} agendadas`, fontSize: 6.5, color: "#7c3aed" },
                ],
                fillColor: "#f8fafc",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "ATENCIONES", fontSize: 7, bold: true, color: "#065f46" },
                  { text: data.clinicMetrics.attendedAppointments.toString(), fontSize: 13, bold: true, color: "#059669" },
                  { text: "Evoluciones clínicas", fontSize: 6.5, color: "#047857" },
                ],
                fillColor: "#ecfdf5",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "FACTURACIÓN", fontSize: 7, bold: true, color: "#581c87" },
                  { text: data.clinicMetrics.formattedTotalBilled, fontSize: 13, bold: true, color: "#0f172a" },
                  { text: "Ingresos clínica", fontSize: 6.5, color: "#6b21a8" },
                ],
                fillColor: "#faf5ff",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "GASTOS", fontSize: 7, bold: true, color: "#92400e" },
                  { text: data.clinicMetrics.formattedTotalExpenses, fontSize: 13, bold: true, color: "#b45309" },
                  { text: "Pagos a doctores", fontSize: 6.5, color: "#b45309" },
                ],
                fillColor: "#fffbeb",
                margin: [2, 2, 2, 2],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#e2e8f0",
          vLineColor: () => "#e2e8f0",
        },
        margin: [0, 0, 0, 6],
      },

      // Tabla Doctores
      {
        table: {
          headerRows: 1,
          widths: ["*", 50, 65, 85],
          body: doctorTableBody,
        },
        layout: {
          hLineWidth: (i) => (i === 1 ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i) => (i === 1 ? "#cbd5e1" : "#f1f5f9"),
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
        },
        margin: [0, 0, 0, 10],
      },

      // SECCIÓN 2: CURSOS
      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                text: "CURSOS",
                fontSize: 9.5,
                bold: true,
                color: "#1e1b4b",
                fillColor: "#e0e7ff",
                margin: [4, 2, 4, 2],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 4],
      },

      // 4 KPIs Cursos (Tabla de 4 columnas)
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "CURSOS ACTIVOS", fontSize: 7, bold: true, color: "#3730a3" },
                  { text: data.courseMetrics.activeCoursesCount.toString(), fontSize: 13, bold: true, color: "#1e1b4b" },
                  { text: "En ejecución / abiertos", fontSize: 6.5, color: "#4338ca" },
                ],
                fillColor: "#eef2ff",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "ALUMNOS", fontSize: 7, bold: true, color: "#1e40af" },
                  { text: data.courseMetrics.totalStudents.toString(), fontSize: 13, bold: true, color: "#1d4ed8" },
                  { text: "Matriculados", fontSize: 6.5, color: "#2563eb" },
                ],
                fillColor: "#eff6ff",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "FACTURACIÓN", fontSize: 7, bold: true, color: "#065f46" },
                  { text: data.courseMetrics.formattedTotalBilled, fontSize: 13, bold: true, color: "#059669" },
                  { text: "Cobros cursos", fontSize: 6.5, color: "#047857" },
                ],
                fillColor: "#ecfdf5",
                margin: [2, 2, 2, 2],
              },
              {
                stack: [
                  { text: "GASTOS", fontSize: 7, bold: true, color: "#92400e" },
                  { text: data.courseMetrics.formattedTotalExpenses, fontSize: 13, bold: true, color: "#b45309" },
                  { text: "Egresos cursos", fontSize: 6.5, color: "#b45309" },
                ],
                fillColor: "#fffbeb",
                margin: [2, 2, 2, 2],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#e2e8f0",
          vLineColor: () => "#e2e8f0",
        },
        margin: [0, 0, 0, 6],
      },

      // Tabla Cursos
      {
        table: {
          headerRows: 1,
          widths: ["*", 65, 80, 50, 85],
          body: courseTableBody,
        },
        layout: {
          hLineWidth: (i) => (i === 1 ? 1 : 0.5),
          vLineWidth: () => 0,
          hLineColor: (i) => (i === 1 ? "#cbd5e1" : "#f1f5f9"),
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5,
        },
        margin: [0, 0, 0, 8],
      },

      // Pie de Página
      {
        columns: [
          {
            text: `Generado automáticamente por FACOP ERP — ${data.generatedAt || new Date().toLocaleString("es-EC")}`,
            fontSize: 7,
            color: "#94a3b8",
          },
          {
            text: "Confidencial — Uso Interno",
            fontSize: 7,
            color: "#94a3b8",
            alignment: "right",
          },
        ],
        margin: [0, 4, 0, 0],
      },
    ],
    styles: {
      tableHeader: {
        fontSize: 7.5,
        bold: true,
        color: "#475569",
        fillColor: "#f1f5f9",
      },
      tableEmpty: {
        fontSize: 8,
        italics: true,
        color: "#94a3b8",
        margin: [0, 4, 0, 4],
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
  };

  const pdfDoc = pdfMakeBuild.createPdf(docDefinition);
  const rawData = await pdfDoc.getBuffer();
  return Buffer.from(rawData);
}
