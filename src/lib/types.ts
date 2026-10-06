export type AppointmentStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type ExceptionType = "block" | "extra";

export interface Patient {
  id: string;
  full_name: string;
  document_number: string | null;
  phone: string;
  email: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  photo_url?: string | null;
  cv_url?: string | null;
  is_doctor?: boolean;
  is_teacher?: boolean;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id?: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reason: string | null;
  admin_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
  doctor?: Doctor | null;
}

export interface AppointmentWithPatient extends Appointment {
  patient: Patient;
}

export interface AvailabilityRule {
  id: string;
  day_of_week: number; // 0=Domingo ... 6=Sábado
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

export interface AvailabilityException {
  id: string;
  date: string;        // YYYY-MM-DD
  type: ExceptionType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export interface TimeSlot {
  start: string;  // ISO timestamp
  end: string;    // ISO timestamp
  available: boolean;
}
