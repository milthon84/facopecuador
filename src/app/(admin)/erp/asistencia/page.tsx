import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { ecuadorDateOf, ecuadorRangeToUtc } from "@/lib/ecuador-time";
import AttendanceAdminClient from "./AttendanceAdminClient";
import type { AttendanceOfficeSettings, AttendanceShift, AttendancePunch } from "@/lib/attendance";

export const dynamic = "force-dynamic";

export default async function AsistenciaPage() {
  await assertPermission("/erp/asistencia");
  const canEdit = await hasWritePermission("/erp/asistencia");

  const sessionSupabase = createClient();
  const { data: { user } } = await sessionSupabase.auth.getUser();

  const supabase = createAdminClient();
  const today = ecuadorDateOf(new Date());

  // Rango inicial: inicio de mes hasta hoy
  const monthStart = today.substring(0, 7) + "-01";
  const { fromIso, toExclusiveIso } = ecuadorRangeToUtc(monthStart, today);

  const role = (user?.app_metadata?.role as string) ?? "recepcionista";
  const isAdmin = role === "admin";

  const [settingsRes, shiftRes, profilesRes, punchesRes] = await Promise.all([
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
    supabase
      .from("user_profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .order("full_name"),
    isAdmin
      ? supabase
          .from("attendance_punches")
          .select("*")
          .gte("punched_at", fromIso)
          .order("punched_at", { ascending: false })
      : supabase
          .from("attendance_punches")
          .select("*")
          .eq("user_id", user?.id || "")
          .gte("punched_at", fromIso)
          .order("punched_at", { ascending: false }),
  ]);

  const officeSettings: AttendanceOfficeSettings = settingsRes.data || {
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

  const shift: AttendanceShift = shiftRes.data || {
    id: "default",
    name: "Jornada Regular",
    start_time: "08:00:00",
    end_time: "17:00:00",
    grace_minutes: 10,
    is_active: true,
  };

  const allProfiles = profilesRes.data || [];
  const punches: AttendancePunch[] = punchesRes.data || [];

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <AttendanceAdminClient
        initialTodayDate={today}
        initialOfficeSettings={officeSettings}
        initialShift={shift}
        initialPunches={punches}
        allProfiles={allProfiles}
        canEdit={canEdit}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}
