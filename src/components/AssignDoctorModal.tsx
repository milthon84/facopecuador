"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Stethoscope, Check, Loader2, X, AlertCircle } from "lucide-react";
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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (!canModify) return null;

  function openModal(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedDoctorId(currentDoctor?.id || "");
    setErrorMsg(null);
    setSearch("");
    setOpen(true);
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
  }

  async function handleSave() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: appointmentId,
          doctor_id: selectedDoctorId ? selectedDoctorId : null,
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
    }
  }

  const filteredDoctors = doctors.filter((doc) => {
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-sm bg-white hover:bg-lilac-50/60 border-lilac-200 text-lilac-700 active:scale-95"
      >
        <Stethoscope size={14} className="text-lilac-600" />
        <span>{currentDoctor ? "Cambiar Doctor" : "Asignar Doctor"}</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={closeModal}
        title={currentDoctor ? "Cambiar Doctor Asignado" : "Asignar Doctor a la Cita"}
        subtitle="Selecciona el profesional odontólogo o especialista que atenderá la cita."
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
          {doctors.length > 4 && (
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

          {/* Lista de opciones de doctor */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {/* Opción Sin Asignar */}
            <label
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                selectedDoctorId === ""
                  ? "border-lilac-500 bg-lilac-50/50 text-lilac-900 shadow-sm"
                  : "border-gray-200 hover:border-lilac-200 bg-white text-ink-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold">
                  —
                </div>
                <div>
                  <div className="text-xs font-semibold">Sin doctor asignado</div>
                  <div className="text-[11px] text-ink-500">Dejar pendiente de asignación</div>
                </div>
              </div>
              <input
                type="radio"
                name="doctor_choice"
                value=""
                checked={selectedDoctorId === ""}
                onChange={() => setSelectedDoctorId("")}
                className="text-lilac-600 focus:ring-lilac-500 h-4 w-4"
              />
            </label>

            {filteredDoctors.map((doc) => {
              const isSelected = selectedDoctorId === doc.id;
              return (
                <label
                  key={doc.id}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "border-lilac-500 bg-lilac-50/50 text-lilac-900 shadow-sm"
                      : "border-gray-200 hover:border-lilac-200 bg-white text-ink-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {doc.photo_url ? (
                      <img
                        src={doc.photo_url}
                        alt={doc.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-lilac-200 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-lilac-100 text-lilac-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {doc.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{doc.full_name}</div>
                      <div className="text-[11px] text-ink-500 truncate">
                        {doc.specialty || "Odontología General"}
                      </div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="doctor_choice"
                    value={doc.id}
                    checked={isSelected}
                    onChange={() => setSelectedDoctorId(doc.id)}
                    className="text-lilac-600 focus:ring-lilac-500 h-4 w-4 shrink-0 ml-2"
                  />
                </label>
              );
            })}

            {filteredDoctors.length === 0 && (
              <div className="text-xs text-center py-6 text-ink-400 bg-gray-50 rounded-xl">
                No se encontraron doctores con el criterio de búsqueda.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-lilac-100">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className="px-4 py-2 border border-lilac-200 rounded-xl text-xs font-semibold text-ink-600 hover:bg-lilac-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              <span>Guardar Asignación</span>
            </button>
          </div>
        </div>
      </StandardModal>
    </>
  );
}
