import { ecuadorTimeOf, ecuadorDateOf } from "./ecuador-time";

export interface AttendanceOfficeSettings {
  id: string;
  office_name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  require_photo: boolean;
  require_location: boolean;
  allow_out_of_bounds: boolean;
  updated_at: string;
}

export interface AttendanceShift {
  id: string;
  name: string;
  start_time: string; // "08:00:00"
  end_time: string;   // "17:00:00"
  grace_minutes: number;
  is_active: boolean;
}

export interface AttendancePunch {
  id: string;
  user_id: string;
  punched_at: string;
  punch_type: "in" | "out";
  photo_url: string;
  photo_path: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  distance_meters: number | null;
  is_in_office: boolean;
  is_late: boolean;
  late_minutes: number;
  device_info: string | null;
  ip_address: string | null;
  notes: string | null;
  created_at: string;
  user_profile?: {
    full_name: string;
    role: string;
  } | null;
  user_email?: string;
}

/**
 * Calcula la distancia en metros entre dos coordenadas geográficas usando la fórmula de Haversine.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

/**
 * Evalúa si una marcación de entrada califica como atraso según el turno asignado y minutos de gracia.
 */
export function evaluatePunctuality(
  punchedAtIso: string,
  shiftStartTime: string = "08:00:00",
  graceMinutes: number = 10
): { isLate: boolean; lateMinutes: number } {
  const localTime = ecuadorTimeOf(punchedAtIso); // "HH:mm"
  const [punchH, punchM] = localTime.split(":").map(Number);
  const [shiftH, shiftM] = shiftStartTime.split(":").map(Number);

  const punchMinutesOfDay = punchH * 60 + punchM;
  const shiftMinutesOfDay = shiftH * 60 + shiftM;
  const limitMinutesOfDay = shiftMinutesOfDay + graceMinutes;

  if (punchMinutesOfDay > limitMinutesOfDay) {
    return {
      isLate: true,
      lateMinutes: punchMinutesOfDay - shiftMinutesOfDay,
    };
  }

  return { isLate: false, lateMinutes: 0 };
}
