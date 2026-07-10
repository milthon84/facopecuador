"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, Clock, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { validateDocumento, validateEmail, validateTelefono, isPassportDocument } from "@/lib/validators";
import type { TimeSlot } from "@/lib/types";
import { formatDateLocal, formatTimeLocal } from "@/lib/availability";

type Step = "date" | "slot" | "data" | "submitting";

export default function NewAppointmentForm({ initialDate }: { initialDate: string }) {
  const router = useRouter();

  // Parsing initialDate if present to preset selectedDate
  const parsedInitialDate = useMemo(() => {
    if (initialDate) {
      const [y, m, d] = initialDate.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return null;
  }, [initialDate]);

  const [step, setStep] = useState<Step>(parsedInitialDate ? "slot" : "date");
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedInitialDate);
  const [monthCursor, setMonthCursor] = useState(() => {
    if (parsedInitialDate) {
      return new Date(parsedInitialDate.getFullYear(), parsedInitialDate.getMonth(), 1);
    }
    return startOfMonth(new Date());
  });

  // Slots e Info Cita
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Hora personalizada (override de slots)
  const [customTime, setCustomTime] = useState(false);
  const [customStart, setCustomStart] = useState("09:00");
  const [customEnd, setCustomEnd] = useState("09:30");

  const handleCustomStartChange = (val: string) => {
    setCustomStart(val);
    if (!val) return;
    const [hours, minutes] = val.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) return;
    const newHours = (hours + 1) % 24;
    const endStr = `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    setCustomEnd(endStr);
  };

  // Paciente
  const [documentNumber, setDocumentNumber] = useState("");
  const [isPassport, setIsPassport] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  
  // Status de lookup
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");

  // Estado general
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cargar slots cuando cambia la fecha o se sale de hora personalizada
  useEffect(() => {
    if (!selectedDate || customTime) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    
    fetch(`/api/availability?date=${formatDateLocal(selectedDate)}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || []);
      })
      .catch((err) => {
        console.error("Error al cargar disponibilidad:", err);
        setSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, customTime]);

  // Lookup de paciente
  async function lookupPatient(doc: string) {
    const clean = doc.trim();
    if (!clean || clean.length < 3) return;

    setLookupStatus("loading");
    try {
      const r = await fetch(`/api/patients/lookup?document=${encodeURIComponent(clean)}`);
      const data = await r.json();
      if (data.patient) {
        setFullName(data.patient.full_name);
        setPhone(data.patient.phone);
        setEmail(data.patient.email);
        setLookupStatus("found");
        setIsPassport(isPassportDocument(data.patient.document_number || ""));
      } else {
        setLookupStatus("not_found");
      }
    } catch {
      setLookupStatus("not_found");
    }
  }

  // Validación
  function validate(): boolean {
    const errs: Record<string, string> = {};

    const docErr = validateDocumento(documentNumber, isPassport);
    if (docErr) errs.documentNumber = docErr;

    if (!fullName.trim() || fullName.trim().length < 3) {
      errs.fullName = "Nombre completo requerido";
    }

    const telErr = validateTelefono(phone);
    if (telErr) errs.phone = telErr;

    const emailErr = validateEmail(email);
    if (emailErr) errs.email = emailErr;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // Confirmar Cita
  async function submit() {
    if (!validate()) return;

    setStep("submitting");
    setSubmitError(null);

    let starts_at = "";
    let ends_at = "";

    if (customTime && selectedDate) {
      const dateStr = formatDateLocal(selectedDate);
      starts_at = `${dateStr}T${customStart}:00-05:00`;
      ends_at = `${dateStr}T${customEnd}:00-05:00`;
    } else if (selectedSlot) {
      starts_at = selectedSlot.start;
      ends_at = selectedSlot.end;
    }

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: {
            document_number: documentNumber.trim(),
            full_name: fullName.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
          },
          starts_at,
          ends_at,
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear la cita");
      }

      router.push(`/erp/citas/${data.appointment_id}`);
    } catch (err: any) {
      setSubmitError(err.message || "Error al registrar la cita");
      setStep("data");
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Botón regresar en la parte superior y Título */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            if (step === "date") router.back();
            else if (step === "slot") setStep("date");
            else if (step === "data") setStep("slot");
          }}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0 shadow-sm"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Nueva Cita</h1>
          <p className="text-xs text-ink-500">Agendar turno para paciente nuevo o existente.</p>
        </div>
      </div>

      <Stepper step={step} />

      {/* STEP 1: DATE SELECTION */}
      {step === "date" && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 sm:p-6 mt-6">
          <h2 className="text-lg font-semibold mb-1">1. Elegí el día</h2>
          <p className="text-sm text-ink-600 mb-4">Seleccione el día deseado en el calendario.</p>
          <MonthCalendar
            cursor={monthCursor}
            setCursor={setMonthCursor}
            selectedDate={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              setStep("slot");
            }}
          />
        </div>
      )}

      {/* STEP 2: SLOT SELECTION */}
      {step === "slot" && selectedDate && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 sm:p-6 mt-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">2. Elegí el horario</h2>
            <button onClick={() => setStep("date")} className="text-sm text-lilac-700 hover:underline font-semibold">
              Cambiar día
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-gold-50 text-gold-800 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Calendar size={15} />
              {selectedDate.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            
            {/* Toggle hora personalizada */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={customTime}
                onChange={(e) => setCustomTime(e.target.checked)}
                className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 h-3.5 w-3.5"
              />
              <span className="text-xs font-semibold text-ink-700">Hora personalizada</span>
            </label>
          </div>

          {/* Slots predefinidos */}
          {!customTime && (
            <div className="space-y-2">
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-sm text-ink-500 py-6 justify-center">
                  <Loader2 size={18} className="animate-spin text-lilac-500" /> Cargando horarios disponibles...
                </div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-ink-500 py-6 text-center bg-lilac-50/20 border border-dashed border-lilac-100 rounded-xl">
                  No hay horarios disponibles este día.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => {
                    const label = formatTimeLocal(s.start);
                    const isSelected = selectedSlot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s)}
                        className={`py-3 rounded-xl border text-sm font-semibold transition ${
                          !s.available
                            ? "bg-gray-50 text-gray-400/50 cursor-not-allowed border-gray-100"
                            : isSelected
                            ? "bg-lilac-600 text-white border-lilac-600 shadow-sm"
                            : "bg-white border-lilac-200 hover:border-lilac-400 text-ink-800"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Override hora personalizada */}
          {customTime && (
            <div className="grid grid-cols-2 gap-4 border border-dashed border-lilac-200 rounded-xl p-4 bg-lilac-50/10">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Hora de inicio *</label>
                <input
                  type="time"
                  value={customStart}
                  onChange={(e) => handleCustomStartChange(e.target.value)}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Hora de fin *</label>
                <input
                  type="time"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>
            </div>
          )}

          {/* Navegación de botones */}
          <div className="flex justify-between gap-3 pt-3 border-t border-lilac-50">
            <button
              type="button"
              onClick={() => setStep("date")}
              className="px-5 py-2 border border-lilac-200 text-ink-600 hover:bg-lilac-50 rounded-xl font-semibold text-sm transition-colors"
            >
              Atrás
            </button>
            
            <button
              type="button"
              disabled={!customTime && !selectedSlot}
              onClick={() => setStep("data")}
              className="flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white px-5 py-2 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              Continuar <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PATIENT DATA */}
      {(step === "data" || step === "submitting") && selectedDate && (
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 sm:p-6 mt-6 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">3. Tus datos</h2>
            <button onClick={() => setStep("slot")} className="text-sm text-lilac-700 hover:underline font-semibold">
              Cambiar horario
            </button>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-gold-50 text-gold-800 text-sm font-medium">
            <Calendar size={15} />
            {(() => {
              const datePart = selectedDate.toLocaleDateString("es-EC", {
                weekday: "long", day: "numeric", month: "long"
              });
              if (customTime) {
                return `${datePart} a las ${customStart} - ${customEnd}`;
              }
              const dt = new Date(selectedSlot?.start || "");
              return `${datePart} a las ${formatTimeLocal(dt)}`;
            })()}
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid gap-4">
            {/* Cédula/RUC con Lookup */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-700">Documento de Identidad *</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPassport}
                    onChange={(e) => {
                      setIsPassport(e.target.checked);
                      setDocumentNumber("");
                      setErrors(p => {
                        const newErrs = { ...p };
                        delete newErrs.documentNumber;
                        return newErrs;
                      });
                      if (lookupStatus !== "idle") setLookupStatus("idle");
                    }}
                    className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-ink-700">Pasaporte</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder={isPassport ? "Ej: PA987654" : "Ej: 1712345678"}
                  value={documentNumber}
                  onChange={(e) => {
                    const val = isPassport ? e.target.value.toUpperCase() : e.target.value.replace(/[^0-9]/g, "");
                    setDocumentNumber(val);
                    if (lookupStatus !== "idle") setLookupStatus("idle");
                  }}
                  onBlur={() => lookupPatient(documentNumber)}
                  className={`w-full border rounded-xl pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono ${
                    errors.documentNumber ? "border-red-400" : "border-lilac-200"
                  }`}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {lookupStatus === "loading" && <Loader2 size={16} className="animate-spin text-lilac-500" />}
                  {lookupStatus === "found" && <CheckCircle2 size={16} className="text-green-500" />}
                </div>
              </div>
              {lookupStatus === "found" && (
                <p className="text-[11px] text-green-600 font-medium">Paciente registrado (datos cargados automáticamente)</p>
              )}
              {lookupStatus === "not_found" && (
                <p className="text-[11px] text-ink-500">Paciente no registrado (ingresa datos manuales)</p>
              )}
              {errors.documentNumber && <p className="text-xs text-red-500">{errors.documentNumber}</p>}
            </div>

            {/* Nombre Completo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Nombre completo *</label>
              <input
                type="text"
                placeholder="Tu nombre y apellido"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white ${
                  errors.fullName ? "border-red-400" : "border-lilac-200"
                }`}
              />
              {errors.fullName && <p className="text-xs text-red-500">{errors.fullName}</p>}
            </div>

            {/* Teléfono y Correo */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Teléfono *</label>
                <input
                  type="text"
                  placeholder="0997631134"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono ${
                    errors.phone ? "border-red-400" : "border-lilac-200"
                  }`}
                />
                {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Email *</label>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white ${
                    errors.email ? "border-red-400" : "border-lilac-200"
                  }`}
                />
                {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
              </div>
            </div>

            {/* Motivo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Motivo de consulta (opcional)</label>
              <textarea
                placeholder="Brevemente, ¿qué le trae a la cita?"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-between gap-3 pt-3 border-t border-lilac-50">
            <button
              type="button"
              disabled={step === "submitting"}
              onClick={() => setStep("slot")}
              className="px-5 py-2 border border-lilac-200 text-ink-600 hover:bg-lilac-50 rounded-xl font-semibold text-sm transition-colors"
            >
              Atrás
            </button>
            
            <button
              type="button"
              disabled={step === "submitting"}
              onClick={submit}
              className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-lilac-200 disabled:opacity-50"
            >
              {step === "submitting" ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Reservando...
                </>
              ) : (
                "Confirmar cita"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUX COMPONENTS & HELPERS ──────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  const steps = ["date", "slot", "data"];
  const currentIdx = steps.indexOf(step === "submitting" ? "data" : step);
  return (
    <div className="flex gap-2 mt-4">
      {steps.map((s, i) => (
        <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= currentIdx ? "bg-gold-500" : "bg-lilac-100"}`} />
      ))}
    </div>
  );
}

function MonthCalendar({
  cursor, setCursor, selectedDate, onSelect,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString("es-EC", { month: "long", year: "numeric" });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => setCursor(addMonths(cursor, -1))} className="p-2 hover:bg-lilac-50 rounded-lg text-ink-600">
          <ChevronLeft size={16} />
        </button>
        <div className="font-semibold capitalize text-sm text-ink-800">{monthLabel}</div>
        <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 hover:bg-lilac-50 rounded-lg text-ink-600">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          if (!d) return <div key={i} />;
          
          // Nota: Para administradores permitimos seleccionar fechas pasadas
          const isSelected = selectedDate?.toDateString() === d.toDateString();
          const isToday = d.toDateString() === new Date().toDateString();
          
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(d)}
              className={`aspect-square rounded-xl text-sm font-bold transition flex items-center justify-center ${
                isSelected
                  ? "bg-lilac-600 text-white shadow-md shadow-lilac-100"
                  : isToday
                  ? "bg-lilac-50 text-lilac-700 border border-lilac-200"
                  : "bg-white border border-lilac-100 hover:border-lilac-300 hover:bg-lilac-50 text-ink-800"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function buildMonthGrid(cursor: Date): (Date | null)[] {
  const first = startOfMonth(cursor);
  const startDow = first.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
