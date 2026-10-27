import { getSessionUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { logAudit, getIpFromRequest } from "@/lib/audit";
import { hasCoworkingDocuments } from "@/lib/coworking-types";

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const role = (user.app_metadata?.role as string) ?? "recepcionista";

  if (role !== "admin") {
    const { data } = await adminClient
      .from("role_permissions")
      .select("path")
      .eq("role_name", role);
    const paths = (data || []).map((p: any) => p.path);
    if (!paths.includes("/erp/coworking") && !paths.includes("/erp/modificar")) {
      return NextResponse.json({ error: "Sin permisos para gestionar coworking" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();
    const { id, status, extra } = body;

    if (!id) {
      return NextResponse.json({ error: "El ID es requerido" }, { status: 400 });
    }

    const { data: prevRental } = await adminClient
      .from("coworking_rentals")
      .select("*")
      .eq("id", id)
      .single();

    if (!prevRental) {
      return NextResponse.json({ error: "Reserva de coworking no encontrada" }, { status: 404 });
    }

    // Exigir contrato y descargo de responsabilidad para sillones y clínica completa al finalizar/completar
    if (status === "finalizado") {
      const isClinicalSpace =
        prevRental.resource_type === "puesto_trabajo" || prevRental.resource_type === "clinica_completa";
      if (isClinicalSpace) {
        const hasContract = hasCoworkingDocuments(prevRental.contract_url);
        const hasWaiver = hasCoworkingDocuments(prevRental.waiver_url);
        if (!hasContract || !hasWaiver) {
          const missing: string[] = [];
          if (!hasContract) missing.push("Contrato de Arrendamiento");
          if (!hasWaiver) missing.push("Descargo de Responsabilidad firmado");
          return NextResponse.json(
            {
              error: `Para completar el alquiler de sillones dentales o clínica completa es obligatorio adjuntar: ${missing.join(" y ")}. Por favor carga los documentos requeridos antes de finalizar.`,
              missingDocs: true,
              hasContract,
              hasWaiver,
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updateData.status = status;
    if (extra && typeof extra === "object") Object.assign(updateData, extra);

    const { data: updated, error } = await adminClient
      .from("coworking_rentals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auditoría
    try {
      await logAudit({
        user_id: user.id,
        user_email: user.email ?? "unknown",
        action: "update",
        resource: "appointment",
        resource_id: id,
        description: `Reserva coworking actualizada a ${status || prevRental.status}`,
        metadata: {
          previous_status: prevRental.status,
          new_status: status || prevRental.status,
          doctor_name: prevRental.doctor_name,
          resource_type: prevRental.resource_type,
        },
        ip_address: getIpFromRequest(req),
      });
    } catch (auditErr) {
      console.warn("Error guardando auditoría de coworking:", auditErr);
    }

    return NextResponse.json({ success: true, rental: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar reserva" }, { status: 500 });
  }
}
