"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle2, UserCheck, Loader2 } from "lucide-react";
import { getMyAttendanceTodayAction } from "@/app/(admin)/erp/asistencia/actions";
import AttendancePunchModal from "./AttendancePunchModal";
import type { AttendanceOfficeSettings, AttendancePunch } from "@/lib/attendance";
import { ecuadorTimeOf } from "@/lib/ecuador-time";

export default function AttendancePunchHeaderButton() {
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [punchType, setPunchType] = useState<"in" | "out">("in");
  const [officeSettings, setOfficeSettings] = useState<AttendanceOfficeSettings | null>(null);
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
      console.warn("No se pudo cargar estado de asistencia en el header:", e);
    } finally {
      setLoading(false);
    }
  }

  const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null;
  const hasCheckedIn = punches.some(p => p.punch_type === "in");
  const hasCheckedOut = punches.some(p => p.punch_type === "out");
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
    setPunches(prev => [...prev, newPunch]);
  }

  if (loading) {
    return (
      <div className="h-8 px-3 rounded-lg bg-white/10 flex items-center gap-1.5 text-xs text-white/60 animate-pulse">
        <Clock size={13} />
        <span className="hidden sm:inline">Asistencia...</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleOpenPunch}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs active:scale-95 ${
          isCheckedIn
            ? "bg-amber-500/90 hover:bg-amber-500 text-white border border-amber-400/40"
            : hasCheckedIn && hasCheckedOut
            ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
            : "bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40"
        }`}
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-300"></span>
            </span>
            <UserCheck size={14} />
            <span className="hidden sm:inline">Marcar Salida</span>
            <span className="text-[10px] opacity-80">({ecuadorTimeOf(lastPunch.punched_at)})</span>
          </>
        ) : hasCheckedIn && hasCheckedOut ? (
          <>
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Jornada Completa</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
            </span>
            <UserCheck size={14} />
            <span>Timbrar Entrada</span>
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
