"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Stethoscope, Check, Loader2, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";

interface Doctor {
  id: string;
  full_name: string;
  specialty?: string | null;
  photo_url?: string | null;
}

interface Props {
  appointmentId: string;
  currentDoctor?: Doctor | null;
  doctors: Doctor[];
  canModify?: boolean;
}

export default function AssignDoctorModal({
  appointmentId,
  currentDoctor = null,
  doctors = [],
  canModify = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(currentDoctor?.id || "");
  const [savingDoctorId, setSavingDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Ordenar doctores: Odontólogo General siempre primero
  const sortedDoctors = useMemo(() => {
    return [...doctors].sort((a, b) => {
      const isGeneralA =
        (a.specialty || "").toLowerCase().includes("general") ||
        (a.full_name || "").toLowerCase().includes("general");
      const isGeneralB =
        (b.specialty || "").toLowerCase().includes("general") ||
        (b.full_name || "").toLowerCase().includes("general");
      if (isGeneralA && !isGeneralB) return -1;
      if (!isGeneralA && isGeneralB) return 1;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [doctors]);

  if (!canModify) return null;

  function openModal(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedDoctorId(currentDoctor?.id || "");
    setErrorMsg(null);
    setSearch("");
    setSavingDoctorId(null);
    setOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
  }

  // Asignación rápida con 1 solo clic
  async function handleQuickAssign(docId: string) {
    if (loading) return;
    setSavingDoctorId(docId);
    setSelectedDoctorId(docId);
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointmentId,
          doctor_id: docId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el doctor asignado.");
      }

      router.refresh();
      setOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al asignar doctor");
    } finally {
      setLoading(false);
      setSavingDoctorId(null);
    }
  }

  const filteredDoctors = sortedDoctors.filter((doc) => {
    const q = search.toLowerCase();
    return (
      doc.full_name.toLowerCase().includes(q) ||
      (doc.specialty && doc.specialty.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm bg-white hover:bg-lilac-50/60 border-lilac-200 text-lilac-700 active:scale-95 cursor-pointer"
      >
        <Stethoscope size={14} className="text-lilac-600" />
        <span>{currentDoctor ? "Cambiar Doctor" : "Asignar Doctor"}</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={closeModal}
        title={currentDoctor ? "Cambiar Doctor Asignado" : "Asignar Doctor a la Cita"}
        subtitle="Haz clic sobre el doctor u odontólogo para asignarlo rápidamente a la cita."
        icon={<Stethoscope className="text-lilac-600" size={20} />}
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Buscador si hay más de 4 doctores */}
          {sortedDoctors.length > 4 && (
            <div>
              <input
                type="text"
                placeholder="Buscar por nombre o especialidad..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
              />
            </div>
          )}

          {/* Lista de opciones de doctor (1-clic para asignar) */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {filteredDoctors.map((doc) => {
              const isSelected = selectedDoctorId === doc.id;
              const isSavingThis = savingDoctorId === doc.id;
              const isGeneral =
                (doc.specialty || "").toLowerCase().includes("general") ||
                (doc.full_name || "").toLowerCase().includes("general");

              return (
                <div
                  key={doc.id}
                  onClick={() => handleQuickAssign(doc.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-lilac-500 bg-lilac-50/70 text-lilac-950 shadow-xs ring-1 ring-lilac-400"
                      : "border-lilac-100 hover:border-lilac-300 hover:bg-lilac-50/30 bg-white text-ink-800"
                  } ${loading && !isSavingThis ? "opacity-60 pointer-events-none" : ""}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.photo_url ? (
                      <img
                        src={doc.photo_url}
                        alt={doc.full_name}
                        className="w-9 h-9 rounded-full object-cover border border-lilac-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-lilac-100 text-lilac-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {doc.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1.5">
                        <span>{doc.full_name}</span>
                        {isGeneral && (
                          <span className="text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded-md shrink-0">
                            Principal
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {doc.specialty || "Odontología General"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {isSavingThis ? (
                      <div className="flex items-center gap-1 text-xs font-bold text-lilac-700 bg-white px-2.5 py-1 rounded-xl border border-lilac-200 shadow-2xs">
                        <Loader2 size={13} className="animate-spin text-lilac-600" />
                        <span>Asignando...</span>
                      </div>
                    ) : isSelected ? (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                        <Check size={13} />
                        <span>Actual</span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-lilac-600 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 px-2.5 py-1 rounded-xl transition">
                        Asignar
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredDoctors.length === 0 && (
              <div className="text-xs text-center py-6 text-ink-400 bg-gray-50 rounded-xl">
                No se encontraron doctores habilitados para atención clínica.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-lilac-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="px-4 py-2 border border-lilac-200 rounded-xl text-xs font-semibold text-ink-600 hover:bg-lilac-50 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </StandardModal>
    </>
  );
}
