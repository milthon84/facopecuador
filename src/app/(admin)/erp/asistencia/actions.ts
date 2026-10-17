"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { optimizeImageForWeb } from "@/lib/image-optimizer";
import { logAudit } from "@/lib/audit";
import { ecuadorDateOf, ecuadorTimeOf, ecuadorRangeToUtc } from "@/lib/ecuador-time";
import { calculateDistanceMeters, evaluatePunctuality } from "@/lib/attendance";
import type { AttendanceOfficeSettings, AttendanceShift, AttendancePunch } from "@/lib/attendance";
import { revalidatePath } from "next/cache";

export interface PunchActionResult {
  success: boolean;
  error?: string;
  punch?: AttendancePunch;
  distanceMeters?: number | null;
  isInOffice?: boolean;
  isLate?: boolean;
  lateMinutes?: number;
}

/**
 * Obtiene el estado de marcaciones de hoy para el usuario actual y la configuración de la oficina.
 */
export async function getMyAttendanceTodayAction(): Promise<{
  success: boolean;
  error?: string;
  user?: { id: string; email: string; full_name?: string };
  todayDate?: string;
  punches?: AttendancePunch[];
  officeSettings?: AttendanceOfficeSettings;
  activeShift?: AttendanceShift;
  canPunchIn?: boolean;
  canPunchOut?: boolean;
}> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) {
      return { success: false, error: "No autenticado" };
    }

    const today = ecuadorDateOf(new Date());
    const { fromIso, toExclusiveIso } = ecuadorRangeToUtc(today, today);
    const supabase = createAdminClient();

    const [punchesRes, profileRes, settingsRes, shiftRes] = await Promise.all([
      supabase
        .from("attendance_punches")
        .select("*")
        .eq("user_id", user.id)
        .gte("punched_at", fromIso)
        .lt("punched_at", toExclusiveIso)
        .order("punched_at", { ascending: true }),
      supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", user.id)
        .single(),
      supabase
        .from("attendance_office_settings")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("attendance_shifts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const punches: AttendancePunch[] = punchesRes.data || [];
    const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;

    // Lógica de disponibilidad de botones
    const canPunchIn = !lastPunch || lastPunch.punch_type === "out";
    const canPunchOut = lastPunch?.punch_type === "in";

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email || "",
        full_name: profileRes.data?.full_name || user.email?.split("@")[0] || "Colaborador",
      },
      todayDate: today,
      punches,
      officeSettings: settingsRes.data || {
        id: "default",
        office_name: "Sede Principal",
        latitude: -0.1806532,
        longitude: -78.4678382,
        radius_meters: 150,
        require_photo: true,
        require_location: true,
        allow_out_of_bounds: true,
        updated_at: new Date().toISOString(),
      },
      activeShift: shiftRes.data || {
        id: "default",
        name: "Jornada Regular",
        start_time: "08:00:00",
        end_time: "17:00:00",
        grace_minutes: 10,
        is_active: true,
      },
      canPunchIn,
      canPunchOut,
    };
  } catch (err: any) {
    console.error("Error en getMyAttendanceTodayAction:", err);
    return { success: false, error: err.message || "Error al consultar asistencia de hoy" };
  }
}

/**
 * Registra una nueva marcación (Entrada o Salida) con foto selfie y coordenadas GPS.
 */
export async function recordPunchAction(formData: FormData): Promise<PunchActionResult> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Debes iniciar sesión para registrar tu asistencia." };
    }

    const role = (user.app_metadata?.role as string) ?? "recepcionista";
    if (role !== "admin") {
      const supabaseCheck = createAdminClient();
      const { data: perms } = await supabaseCheck
        .from("role_permissions")
        .select("path")
        .eq("role_name", role)
        .in("path", ["/erp/asistencia/timbrar", "/erp/asistencia"]);

      if (!perms || perms.length === 0) {
        return { success: false, error: "Tu rol no tiene permiso para timbrar asistencia." };
      }
    }

    const punchType = formData.get("punchType") as "in" | "out";
    const photoFile = formData.get("photo") as File | null;
    const latStr = formData.get("latitude") as string | null;
    const lngStr = formData.get("longitude") as string | null;
    const accStr = formData.get("accuracy") as string | null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (punchType !== "in" && punchType !== "out") {
      return { success: false, error: "Tipo de marcación inválido." };
    }

    const latitude = latStr ? parseFloat(latStr) : NaN;
    const longitude = lngStr ? parseFloat(lngStr) : NaN;
    const accuracy = accStr ? parseFloat(accStr) : NaN;

    const supabase = createAdminClient();
    const today = ecuadorDateOf(new Date());
    const { fromIso, toExclusiveIso } = ecuadorRangeToUtc(today, today);

    // 1. Validar secuencia de marcaciones de hoy
    const { data: todayPunches } = await supabase
      .from("attendance_punches")
      .select("id, punch_type, punched_at")
      .eq("user_id", user.id)
      .gte("punched_at", fromIso)
      .lt("punched_at", toExclusiveIso)
      .order("punched_at", { ascending: true });

    const lastPunch = todayPunches && todayPunches.length > 0 ? todayPunches[todayPunches.length - 1] : null;

    if (punchType === "in" && lastPunch?.punch_type === "in") {
      return {
        success: false,
        error: `Ya registraste tu entrada hoy a las ${ecuadorTimeOf(lastPunch.punched_at)}. Debes registrar tu salida.`,
      };
    }

    if (punchType === "out" && (!lastPunch || lastPunch.punch_type === "out")) {
      return {
        success: false,
        error: "No puedes registrar salida sin haber registrado tu entrada previamente hoy.",
      };
    }

    // 2. Obtener configuración de oficina
    const { data: rawSettings } = await supabase
      .from("attendance_office_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const officeSettings: AttendanceOfficeSettings = rawSettings || {
      id: "default",
      office_name: "Sede Principal",
      latitude: -0.1806532,
      longitude: -78.4678382,
      radius_meters: 150,
      require_photo: true,
      require_location: true,
      allow_out_of_bounds: true,
      updated_at: new Date().toISOString(),
    };

    // 3. Validar GPS y geocerca
    let distanceMeters: number | null = null;
    let isInOffice = true;

    if (isNaN(latitude) || isNaN(longitude)) {
      if (officeSettings.require_location) {
        return {
          success: false,
          error: "Es obligatorio activar el GPS y conceder permisos de ubicación para registrar tu asistencia.",
        };
      }
    } else {
      distanceMeters = calculateDistanceMeters(
        latitude,
        longitude,
        Number(officeSettings.latitude),
        Number(officeSettings.longitude)
      );
      isInOffice = distanceMeters <= Number(officeSettings.radius_meters);

      if (!isInOffice && !officeSettings.allow_out_of_bounds) {
        return {
          success: false,
          error: `Te encuentras a ${distanceMeters} metros de la clínica (máximo permitido: ${officeSettings.radius_meters} m). Debes estar físicamente en la oficina para marcar.`,
        };
      }
    }

    // 4. Validar y optimizar foto selfie
    if (!photoFile || photoFile.size === 0) {
      if (officeSettings.require_photo) {
        return {
          success: false,
          error: "Es obligatorio tomar una fotografía selfie con la cámara para marcar asistencia.",
        };
      }
    }

    let photoUrl = "";
    let filePath = "";

    if (photoFile && photoFile.size > 0) {
      const rawBytes = Buffer.from(await photoFile.arrayBuffer());
      const { buffer: webpBuffer } = await optimizeImageForWeb(rawBytes, {
        maxWidth: 960,
        maxHeight: 960,
        quality: 80,
        format: "webp",
      });

      const timestamp = Date.now();
      filePath = `${user.id}/${today}_${punchType}_${timestamp}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(filePath, webpBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.error("Error subiendo foto de asistencia:", uploadError);
        return { success: false, error: "Error al guardar la fotografía. Por favor intenta nuevamente." };
      }

      const { data: publicUrlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData?.publicUrl || "";
    }

    // 5. Evaluar puntualidad (solo aplica a 'in')
    let isLate = false;
    let lateMinutes = 0;

    if (punchType === "in") {
      const { data: shift } = await supabase
        .from("attendance_shifts")
        .select("start_time, grace_minutes")
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const startTime = shift?.start_time || "08:00:00";
      const graceMin = shift?.grace_minutes ?? 10;
      const punctuality = evaluatePunctuality(new Date().toISOString(), startTime, graceMin);
      isLate = punctuality.isLate;
      lateMinutes = punctuality.lateMinutes;
    }

    // 6. Insertar registro en BD
    const { data: punch, error: insertError } = await supabase
      .from("attendance_punches")
      .insert({
        user_id: user.id,
        punched_at: new Date().toISOString(),
        punch_type: punchType,
        photo_url: photoUrl,
        photo_path: filePath,
        latitude: !isNaN(latitude) ? latitude : null,
        longitude: !isNaN(longitude) ? longitude : null,
        accuracy: !isNaN(accuracy) ? accuracy : null,
        distance_meters: distanceMeters,
        is_in_office: isInOffice,
        is_late: isLate,
        late_minutes: lateMinutes,
        notes,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error insertando marcación:", insertError);
      return { success: false, error: "Error al guardar el registro en la base de datos." };
    }

    // 7. Auditoría
    const locDesc = isInOffice
      ? `En oficina (${distanceMeters !== null ? `${distanceMeters}m` : "GPS OK"})`
      : `FUERA de oficina (${distanceMeters}m)`;
    const puntDesc = isLate ? ` (Atraso: ${lateMinutes} min)` : " (A tiempo)";

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      resource: "attendance_punch",
      resource_id: punch.id,
      description: `Marcación de ${punchType === "in" ? "Entrada" : "Salida"} por ${user.email} - ${locDesc}${punchType === "in" ? puntDesc : ""}`,
      metadata: {
        punch_type: punchType,
        distance_meters: distanceMeters,
        is_in_office: isInOffice,
        is_late: isLate,
        late_minutes: lateMinutes,
      },
    });

    revalidatePath("/erp/asistencia");
    revalidatePath("/erp");

    return {
      success: true,
      punch,
      distanceMeters,
      isInOffice,
      isLate,
      lateMinutes,
    };
  } catch (err: any) {
    console.error("Error en recordPunchAction:", err);
    return { success: false, error: err.message || "Error al registrar asistencia." };
  }
}

/**
 * Actualiza la configuración de la oficina (coordenadas, radio de geocerca, requerimientos).
 * Requiere rol de Administrador.
 */
export async function updateOfficeSettingsAction(data: {
  office_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  require_photo: boolean;
  require_location: boolean;
  allow_out_of_bounds: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();

    // Comprobar rol admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (user.app_metadata?.role as string) || profile?.role;
    if (role !== "admin") {
      return { success: false, error: "Solo los administradores pueden cambiar la configuración de la oficina." };
    }

    const { data: existing } = await supabase
      .from("attendance_office_settings")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("attendance_office_settings")
        .update({
          office_name: data.office_name,
          latitude: data.latitude,
          longitude: data.longitude,
          radius_meters: data.radius_meters,
          require_photo: data.require_photo,
          require_location: data.require_location,
          allow_out_of_bounds: data.allow_out_of_bounds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("attendance_office_settings")
        .insert({
          office_name: data.office_name,
          latitude: data.latitude,
          longitude: data.longitude,
          radius_meters: data.radius_meters,
          require_photo: data.require_photo,
          require_location: data.require_location,
          allow_out_of_bounds: data.allow_out_of_bounds,
        });
    }

    revalidatePath("/erp/asistencia");
    return { success: true };
  } catch (err: any) {
    console.error("Error en updateOfficeSettingsAction:", err);
    return { success: false, error: err.message || "Error al actualizar configuración" };
  }
}

/**
 * Actualiza el turno regular (hora de inicio, fin y tolerancia).
 */
export async function updateShiftAction(data: {
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("attendance_shifts")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("attendance_shifts")
        .update({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
          grace_minutes: data.grace_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("attendance_shifts").insert({
        name: data.name,
        start_time: data.start_time,
        end_time: data.end_time,
        grace_minutes: data.grace_minutes,
      });
    }

    revalidatePath("/erp/asistencia");
    return { success: true };
  } catch (err: any) {
    console.error("Error en updateShiftAction:", err);
    return { success: false, error: err.message || "Error al actualizar turno" };
  }
}

/**
 * Elimina un registro de marcación (exclusivo para administradores).
 */
export async function deletePunchAction(punchId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionSupabase = createClient();
    const { data: { user } } = await sessionSupabase.auth.getUser();

    if (!user) return { success: false, error: "No autenticado" };

    const supabase = createAdminClient();
    const role = (user.app_metadata?.role as string);

    if (role !== "admin") {
      return { success: false, error: "Permiso denegado. Solo administradores pueden eliminar registros." };
    }

    const { error } = await supabase
      .from("attendance_punches")
      .delete()
      .eq("id", punchId);

    if (error) throw error;

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "delete",
      resource: "attendance_punch",
      resource_id: punchId,
      description: `Registro de asistencia eliminado por el administrador ${user.email}`,
    });

    revalidatePath("/erp/asistencia");
    return { success: true };
  } catch (err: any) {
    console.error("Error en deletePunchAction:", err);
    return { success: false, error: err.message || "Error al eliminar registro" };
  }
}
