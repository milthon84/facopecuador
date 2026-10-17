"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { getMyAttendanceTodayAction } from "@/app/(admin)/erp/asistencia/actions";
import AttendancePunchModal from "./AttendancePunchModal";
import type { AttendanceOfficeSettings, AttendancePunch } from "@/lib/attendance";
import { ecuadorTimeOf } from "@/lib/ecuador-time";

interface Props {
  variant?: "header" | "menu" | "sidebar";
  className?: string;
}

const DEFAULT_OFFICE_SETTINGS: AttendanceOfficeSettings = {
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

export default function AttendancePunchHeaderButton({
  variant = "sidebar",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [punchType, setPunchType] = useState<"in" | "out">("in");
  const [officeSettings, setOfficeSettings] = useState<AttendanceOfficeSettings>(DEFAULT_OFFICE_SETTINGS);
  const [punches, setPunches] = useState<AttendancePunch[]>([]);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const res = await getMyAttendanceTodayAction();
      if (res.success) {
        setPunches(res.punches || []);
        if (res.officeSettings) {
          setOfficeSettings(res.officeSettings);
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar estado de asistencia:", e);
    } finally {
      setLoading(false);
    }
  }

  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const hasCheckedIn = punches.some((p) => p.punch_type === "in");
  const hasCheckedOut = punches.some((p) => p.punch_type === "out");
  const isCheckedIn = lastPunch?.punch_type === "in";

  function handleOpenPunch() {
    if (isCheckedIn) {
      setPunchType("out");
    } else {
      setPunchType("in");
    }
    setModalOpen(true);
  }

  function handlePunchSuccess(newPunch: AttendancePunch) {
    setPunches((prev) => [...prev, newPunch]);
  }

  if (loading) {
    return (
      <div className={`h-9 px-3 rounded-xl bg-gray-100 flex items-center justify-center gap-1.5 text-xs text-gray-400 animate-pulse ${
        variant === "sidebar" ? "w-full" : ""
      }`}>
        <Clock size={14} />
        <span>Cargando asistencia...</span>
      </div>
    );
  }

  const isSidebar = variant === "sidebar" || variant === "menu";

  return (
    <>
      <button
        onClick={handleOpenPunch}
        className={`flex items-center gap-2 rounded-xl text-xs font-bold transition shadow-xs active:scale-95 ${
          isSidebar
            ? "w-full justify-center py-2.5 px-3"
            : "px-3 py-1.5"
        } ${
          isCheckedIn
            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 border border-amber-400/40"
            : hasCheckedIn && hasCheckedOut
            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 border border-emerald-500/40"
        } ${className}`}
        title={
          isCheckedIn
            ? `Entrada registrada a las ${ecuadorTimeOf(lastPunch.punched_at)}. Clic para marcar salida.`
            : hasCheckedIn && hasCheckedOut
            ? "Jornada completada hoy. Clic para ver o marcar de nuevo."
            : "Clic para registrar tu entrada con foto y ubicación."
        }
      >
        {isCheckedIn ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <UserCheck size={15} />
            <span>Marcar Salida</span>
            <span className="text-[10px] opacity-90 font-mono">({ecuadorTimeOf(lastPunch.punched_at)})</span>
          </>
        ) : hasCheckedIn && hasCheckedOut ? (
          <>
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span>Jornada Completa Hoy</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
            </span>
            <UserCheck size={15} />
            <span>Timbrar Mi Asistencia</span>
          </>
        )}
      </button>

      {modalOpen && officeSettings && (
        <AttendancePunchModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          punchType={punchType}
          officeSettings={officeSettings}
          onSuccess={handlePunchSuccess}
        />
      )}
    </>
  );
}
