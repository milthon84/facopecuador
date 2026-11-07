import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import type { UserRole } from "@/lib/roles";
import {
  resolveExpenseArea,
  resolveFacturaSriClave,
  resolveExpenseDocType,
  cleanVisibleNotes,
} from "@/lib/expense-areas";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  efectivo:        "Efectivo",
  transferencia:   "Transferencia",
  tarjeta:         "Tarjeta",
  tarjeta_credito: "Tarjeta",
  credito:         "Crédito",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const areaParam = url.searchParams.get("area");
    const categoryParam = url.searchParams.get("category");
    const paymentParam = url.searchParams.get("payment");

    const sessionClient = createClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const now = new Date();
    const activeMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [year, month] = activeMonth.split("-").map(Number);
    const from = fromParam || new Date(year, month - 1, 1).toISOString().split("T")[0];
    const to = toParam || new Date(year, month, 0).toISOString().split("T")[0];

    const supabase = createAdminClient();

    const { data: expenses, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", from)
      .lte("expense_date", to)
      .eq("status", "registered")
      .order("expense_date", { ascending: false });

    if (error) throw error;

    // Resolver áreas y doc types
    let items = (expenses || []).map((exp: any) => ({
      ...exp,
      resolvedArea: resolveExpenseArea(exp),
    }));

    // Filtros opcionales
    if (areaParam && areaParam !== "all") {
      items = items.filter((exp: any) => exp.resolvedArea === areaParam.toLowerCase());
    }
    if (categoryParam && categoryParam !== "all") {
      items = items.filter((exp: any) => exp.category === categoryParam);
    }
    if (paymentParam && paymentParam !== "all") {
      if (paymentParam === "tarjeta") {
        items = items.filter((exp: any) => exp.payment_method === "tarjeta" || exp.payment_method === "tarjeta_credito");
      } else {
        items = items.filter((exp: any) => exp.payment_method === paymentParam);
      }
    }

    // Formatear filas para Excel
    const rows = items.map((exp: any) => {
      const sriClave = resolveFacturaSriClave(exp);
      const docType = resolveExpenseDocType(exp);
      const docTypeLabel =
        (docType as string) === "factura_sri" || Boolean(sriClave)
          ? "Factura SRI"
          : docType === "nota_venta"
          ? "Nota de Venta"
          : docType === "factura"
          ? "Factura"
          : docType === "sin_documento"
          ? "Sin Comprobante"
          : exp.document_type || "Otro";

      const areaLabel =
        exp.resolvedArea === "clinica"
          ? "Clínica Dental"
          : exp.resolvedArea === "cursos"
          ? "Cursos / Educación"
          : exp.resolvedArea === "general"
          ? "General / Admin"
          : exp.resolvedArea || "General";

      return {
        "Fecha": exp.expense_date,
        "Proveedor / Razón Social": exp.supplier_name || "",
        "RUC Proveedor": exp.supplier_ruc || "",
        "Área": areaLabel,
        "Categoría": exp.category || "",
        "Tipo Comprobante": docTypeLabel,
        "N° Comprobante": exp.document_number || "",
        "Clave SRI / Autorización": sriClave || exp.authorization_number || "",
        "Forma de Pago": PAYMENT_LABELS[exp.payment_method] || exp.payment_method || "",
        "Subtotal 0%": Number(exp.subtotal_0 || 0),
        "Subtotal 15%": Number(exp.subtotal_15 || 0),
        "Subtotal": Number(exp.subtotal || 0),
        "IVA": Number(exp.iva_amount || 0),
        "Total": Number(exp.total || 0),
        "Descripción / Detalle": exp.description || "",
        "Notas": cleanVisibleNotes(exp.notes),
      };
    });

    // Fila de resumen acumulado
    if (rows.length > 0) {
      const sumSub0 = items.reduce((s: number, e: any) => s + Number(e.subtotal_0 || 0), 0);
      const sumSub15 = items.reduce((s: number, e: any) => s + Number(e.subtotal_15 || 0), 0);
      const sumSub = items.reduce((s: number, e: any) => s + Number(e.subtotal || 0), 0);
      const sumIva = items.reduce((s: number, e: any) => s + Number(e.iva_amount || 0), 0);
      const sumTotal = items.reduce((s: number, e: any) => s + Number(e.total || 0), 0);

      rows.push({
        "Fecha": "TOTALES",
        "Proveedor / Razón Social": `${items.length} registro(s)`,
        "RUC Proveedor": "",
        "Área": "",
        "Categoría": "",
        "Tipo Comprobante": "",
        "N° Comprobante": "",
        "Clave SRI / Autorización": "",
        "Forma de Pago": "",
        "Subtotal 0%": sumSub0,
        "Subtotal 15%": sumSub15,
        "Subtotal": sumSub,
        "IVA": sumIva,
        "Total": sumTotal,
        "Descripción / Detalle": "",
        "Notas": "",
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);

    // Ajustar ancho de columnas
    ws["!cols"] = [
      { wch: 12 }, // Fecha
      { wch: 34 }, // Proveedor
      { wch: 15 }, // RUC
      { wch: 18 }, // Área
      { wch: 22 }, // Categoría
      { wch: 18 }, // Tipo Comprobante
      { wch: 20 }, // N° Comprobante
      { wch: 52 }, // Clave SRI
      { wch: 16 }, // Forma de Pago
      { wch: 14 }, // Subtotal 0%
      { wch: 14 }, // Subtotal 15%
      { wch: 14 }, // Subtotal
      { wch: 12 }, // IVA
      { wch: 14 }, // Total
      { wch: 40 }, // Descripción
      { wch: 30 }, // Notas
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      user_role: (user.app_metadata?.role as UserRole) ?? null,
      action: "export",
      resource: "expenses",
      description: `Exportación de gastos (${items.length} registros, periodo: ${activeMonth})`,
      metadata: { count: items.length, month: activeMonth },
      ip_address: getIpFromRequest(req),
    });

    const filename = `gastos_${activeMonth}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Error exportando gastos:", err);
    return NextResponse.json({ error: "Error al exportar gastos" }, { status: 500 });
  }
}
