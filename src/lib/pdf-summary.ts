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
 * Genera el documento PDF de Resumen Ejecutivo (Clínica + Cursos) en 1 sola página
 * con diseño ejecutivo de alto impacto para FACOP ECUADOR QUITO.
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

  // 1. Tabla de Doctores (CLÍNICA)
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
      const isUnassigned = doc.name.toLowerCase().includes("sin doctor");
      const rowBg = isUnassigned ? "#fffbeb" : isEven ? "#faf5ff" : "#ffffff";

      doctorTableBody.push([
        {
          stack: [
            { text: doc.name, bold: true, fontSize: 8.5, color: isUnassigned ? "#92400e" : "#0f172a" },
            { text: doc.specialty || "Odontología", fontSize: 7, color: isUnassigned ? "#b45309" : "#64748b" },
          ],
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
        {
          text: doc.total.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8.5,
          color: isUnassigned ? "#92400e" : "#1e293b",
          fillColor: rowBg,
          margin: [0, 2.5, 0, 0],
        },
        {
          text: doc.attended.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8.5,
          color: isUnassigned ? "#b45309" : "#059669",
          fillColor: rowBg,
          margin: [0, 2.5, 0, 0],
        },
        {
          text: doc.formattedBilled,
          alignment: "right",
          bold: true,
          fontSize: 8.5,
          color: isUnassigned ? "#92400e" : "#0f172a",
          fillColor: rowBg,
          margin: [0, 2.5, 0, 0],
        },
      ]);
    });
  }

  // 2. Tabla de Cursos (CURSOS Y DIPLOMADOS)
  const courseTableBody: TableCell[][] = [
    [
      { text: "CURSO / ESPECIALIDAD", style: "tableHeader", alignment: "left" },
      { text: "ESTADO", style: "tableHeader", alignment: "center" },
      { text: "FECHAS", style: "tableHeader", alignment: "center" },
      { text: "ALUMNOS", style: "tableHeader", alignment: "center" },
      { text: "TOTAL FACTURADO", style: "tableHeader", alignment: "right" },
    ],
  ];

  if (data.courseRows.length === 0) {
    courseTableBody.push([
      { text: "No se registran cursos activos ni facturación en este período.", colSpan: 5, style: "tableEmpty", alignment: "center" },
      {},
      {},
      {},
      {},
    ]);
  } else {
    data.courseRows.forEach((c, idx) => {
      const isEven = idx % 2 === 0;
      const rowBg = isEven ? "#f8fafc" : "#ffffff";
      const isActive = c.statusLabel.toLowerCase().includes("activo") || c.statusLabel.toLowerCase().includes("progreso");

      courseTableBody.push([
        {
          text: c.name,
          bold: true,
          fontSize: 8,
          color: "#0f172a",
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
        {
          text: c.statusLabel,
          alignment: "center",
          bold: true,
          fontSize: 7.5,
          color: isActive ? "#4338ca" : "#64748b",
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
        {
          text: c.dates,
          alignment: "center",
          fontSize: 7.5,
          color: "#475569",
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
        {
          text: c.students.toString(),
          alignment: "center",
          bold: true,
          fontSize: 8,
          color: c.students > 0 ? "#1e1b4b" : "#94a3b8",
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
        {
          text: c.formattedBilled,
          alignment: "right",
          bold: true,
          fontSize: 8,
          color: "#0f172a",
          fillColor: rowBg,
          margin: [0, 1.5, 0, 1.5],
        },
      ]);
    });
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [26, 20, 26, 20],
    content: [
      // Encabezado Principal
      {
        columns: [
          {
            stack: [
              { text: "FACOP ECUADOR QUITO", fontSize: 16, bold: true, color: "#4c1d95" },
              { text: "Resumen Ejecutivo de Gestión", fontSize: 9.5, bold: true, color: "#475569", margin: [0, 1, 0, 0] },
            ],
            width: "*",
          },
          {
            stack: [
              { text: "PERÍODO", fontSize: 7, bold: true, color: "#94a3b8", alignment: "right" },
              { text: data.periodLabel, fontSize: 9.5, bold: true, color: "#1e1b4b", alignment: "right" },
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
                margin: [4, 2.5, 4, 2.5],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 4],
      },

      // 4 KPIs Clínica (Diseño tarjeta ejecutiva)
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "CITAS TOTALES", fontSize: 7, bold: true, color: "#64748b" },
                  { text: data.clinicMetrics.totalAppointments.toString(), fontSize: 13, bold: true, color: "#0f172a", margin: [0, 1, 0, 0] },
                  { text: `${data.clinicMetrics.scheduledAppointments} agendadas`, fontSize: 6.5, color: "#7c3aed" },
                ],
                fillColor: "#f8fafc",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "ATENCIONES", fontSize: 7, bold: true, color: "#065f46" },
                  { text: data.clinicMetrics.attendedAppointments.toString(), fontSize: 13, bold: true, color: "#059669", margin: [0, 1, 0, 0] },
                  { text: "Evoluciones clínicas", fontSize: 6.5, color: "#047857" },
                ],
                fillColor: "#ecfdf5",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "FACTURACIÓN", fontSize: 7, bold: true, color: "#581c87" },
                  { text: data.clinicMetrics.formattedTotalBilled, fontSize: 13, bold: true, color: "#0f172a", margin: [0, 1, 0, 0] },
                  { text: "Ingresos clínica", fontSize: 6.5, color: "#6b21a8" },
                ],
                fillColor: "#faf5ff",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "GASTOS", fontSize: 7, bold: true, color: "#92400e" },
                  { text: data.clinicMetrics.formattedTotalExpenses, fontSize: 13, bold: true, color: "#b45309", margin: [0, 1, 0, 0] },
                  { text: "Pagos a doctores", fontSize: 6.5, color: "#b45309" },
                ],
                fillColor: "#fffbeb",
                margin: [3, 2, 3, 2],
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
                margin: [4, 2.5, 4, 2.5],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 4],
      },

      // 4 KPIs Cursos (Diseño tarjeta ejecutiva)
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              {
                stack: [
                  { text: "CURSOS ACTIVOS", fontSize: 7, bold: true, color: "#3730a3" },
                  { text: data.courseMetrics.activeCoursesCount.toString(), fontSize: 13, bold: true, color: "#1e1b4b", margin: [0, 1, 0, 0] },
                  { text: "En ejecución / abiertos", fontSize: 6.5, color: "#4338ca" },
                ],
                fillColor: "#eef2ff",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "ALUMNOS", fontSize: 7, bold: true, color: "#1e40af" },
                  { text: data.courseMetrics.totalStudents.toString(), fontSize: 13, bold: true, color: "#1d4ed8", margin: [0, 1, 0, 0] },
                  { text: "Matriculados", fontSize: 6.5, color: "#2563eb" },
                ],
                fillColor: "#eff6ff",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "FACTURACIÓN", fontSize: 7, bold: true, color: "#065f46" },
                  { text: data.courseMetrics.formattedTotalBilled, fontSize: 13, bold: true, color: "#059669", margin: [0, 1, 0, 0] },
                  { text: "Cobros cursos", fontSize: 6.5, color: "#047857" },
                ],
                fillColor: "#ecfdf5",
                margin: [3, 2, 3, 2],
              },
              {
                stack: [
                  { text: "GASTOS", fontSize: 7, bold: true, color: "#92400e" },
                  { text: data.courseMetrics.formattedTotalExpenses, fontSize: 13, bold: true, color: "#b45309", margin: [0, 1, 0, 0] },
                  { text: "Egresos cursos", fontSize: 6.5, color: "#b45309" },
                ],
                fillColor: "#fffbeb",
                margin: [3, 2, 3, 2],
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
            text: `Generado automáticamente por FACOP ERP — Quito, Ecuador — ${data.generatedAt || new Date().toLocaleString("es-EC")}`,
            fontSize: 7,
            color: "#94a3b8",
          },
          {
            text: "Documento Confidencial — FACOP ECUADOR QUITO",
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
