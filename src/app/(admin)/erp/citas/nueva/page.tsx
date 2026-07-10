import NewAppointmentForm from "./NewAppointmentForm";
import { hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const canEditAgenda = await hasWritePermission("/erp");
  const canEditCalendar = await hasWritePermission("/erp/calendario");
  if (!canEditAgenda && !canEditCalendar) {
    throw new Error("Sin permisos de modificación");
  }
  const searchParams = await searchParamsPromise;
  // Obtener la fecha de hoy en la zona horaria de Ecuador (America/Guayaquil)
  const options = { timeZone: "America/Guayaquil", year: "numeric" as const, month: "2-digit" as const, day: "2-digit" as const };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  
  const todayStr = y && m && d ? `${y}-${m}-${d}` : new Date().toISOString().split("T")[0];
  const initialDate = searchParams?.date || todayStr;

  return <NewAppointmentForm initialDate={initialDate} />;
}
