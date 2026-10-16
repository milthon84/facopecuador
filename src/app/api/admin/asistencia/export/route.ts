import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { logAudit } from "@/lib/audit";
import { ecuadorDateOf, ecuadorTimeOf, ecuadorRangeToUtc } from "@/lib/ecuador-time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const sessionClient = createClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const todayStr = ecuadorDateOf(new Date());
    const startDate = fromParam || todayStr.substring(0, 7) + "-01";
    const endDate = toParam || todayStr;

    const { fromIso, toExclusiveIso } = ecuadorRangeToUtc(startDate, endDate);
    const supabase = createAdminClient();

    const [{ data: punches }, { data: profiles }] = await Promise.all([
      supabase
        .from("attendance_punches")
        .select("*")
        .gte("punched_at", fromIso)
        .lt("punched_at", toExclusiveIso)
        .order("punched_at", { ascending: true }),
      supabase
        .from("user_profiles")
        .select("id, full_name, role"),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Hoja 1: Detalle de Marcaciones
    const detailRows = (punches || []).map((p) => {
      const prof = profileMap.get(p.user_id);
      const nombre = prof?.full_name || "Usuario";
      const rol = prof?.role || "Personal";
      const fecha = ecuadorDateOf(p.punched_at);
      const hora = ecuadorTimeOf(p.punched_at);
      const tipo = p.punch_type === "in" ? "Entrada" : "Salida";
      const puntualidad = p.punch_type === "in"
        ? p.is_late
          ? `Atraso (${p.late_minutes} min)`
          : "A tiempo"
        : "--";
      const ubicacion = p.is_in_office ? "En Oficina" : "Fuera de Oficina";
      const distancia = p.distance_meters !== null ? `${p.distance_meters} m` : "N/D";
      const coords = p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : "N/D";
      const mapaUrl = p.latitude && p.longitude
        ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}`
        : "";

      return {
        "Fecha": fecha,
        "Hora": hora,
        "Colaborador": nombre,
        "Rol / Cargo": rol,
        "Tipo": tipo,
        "Puntualidad": puntualidad,
        "Minutos Atraso": p.is_late ? p.late_minutes : 0,
        "Ubicación": ubicacion,
        "Distancia (m)": distancia,
        "Coordenadas": coords,
        "Mapa": mapaUrl,
        "Foto Selfie URL": p.photo_url || "",
      };
    });

    // Hoja 2: Resumen Consolidado por Colaborador
    const userSummaryMap = new Map<string, {
      nombre: string;
      rol: string;
      diasAsistidos: Set<string>;
      totalEntradas: number;
      totalSalidas: number;
      totalAtrasos: number;
      minutosAtraso: number;
      fueraOficina: number;
    }>();

    (punches || []).forEach((p) => {
      const prof = profileMap.get(p.user_id);
      const uid = p.user_id;
      if (!userSummaryMap.has(uid)) {
        userSummaryMap.set(uid, {
          nombre: prof?.full_name || "Usuario",
          rol: prof?.role || "Personal",
          diasAsistidos: new Set<string>(),
          totalEntradas: 0,
          totalSalidas: 0,
          totalAtrasos: 0,
          minutosAtraso: 0,
          fueraOficina: 0,
        });
      }
      const item = userSummaryMap.get(uid)!;
      const fecha = ecuadorDateOf(p.punched_at);
      item.diasAsistidos.add(fecha);

      if (p.punch_type === "in") {
        item.totalEntradas++;
        if (p.is_late) {
          item.totalAtrasos++;
          item.minutosAtraso += p.late_minutes || 0;
        }
      } else {
        item.totalSalidas++;
      }

      if (!p.is_in_office) {
        item.fueraOficina++;
      }
    });

    const summaryRows = Array.from(userSummaryMap.values()).map((s) => ({
      "Colaborador": s.nombre,
      "Rol / Cargo": s.rol,
      "Días con Asistencia": s.diasAsistidos.size,
      "Total Entradas": s.totalEntradas,
      "Total Salidas": s.totalSalidas,
      "Días con Atraso": s.totalAtrasos,
      "Minutos Totales de Atraso": s.minutosAtraso,
      "Marcaciones Fuera de Oficina": s.fueraOficina,
    }));

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary["!cols"] = [
      { wch: 28 }, // Colaborador
      { wch: 18 }, // Rol
      { wch: 20 }, // Días Asistidos
      { wch: 15 }, // Total Entradas
      { wch: 15 }, // Total Salidas
      { wch: 16 }, // Días con Atraso
      { wch: 24 }, // Minutos de Atraso
      { wch: 26 }, // Fuera de oficina
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Consolidado");

    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail["!cols"] = [
      { wch: 12 }, // Fecha
      { wch: 10 }, // Hora
      { wch: 28 }, // Colaborador
      { wch: 16 }, // Rol
      { wch: 12 }, // Tipo
      { wch: 18 }, // Puntualidad
      { wch: 16 }, // Minutos Atraso
      { wch: 18 }, // Ubicación
      { wch: 14 }, // Distancia
      { wch: 22 }, // Coordenadas
      { wch: 35 }, // Mapa
      { wch: 35 }, // Foto URL
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle de Marcaciones");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "export",
      resource: "attendance_punch",
      description: `Exportación de reporte de asistencia en Excel (${startDate} a ${endDate})`,
    });

    const filename = `Asistencia_${startDate}_al_${endDate}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (err: any) {
    console.error("Error exportando reporte de asistencia:", err);
    return NextResponse.json({ error: err.message || "Error al generar reporte Excel" }, { status: 500 });
  }
}
