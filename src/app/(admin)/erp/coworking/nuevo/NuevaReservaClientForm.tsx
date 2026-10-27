"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Stethoscope,
  GraduationCap,
  Presentation,
  Calendar,
  Clock,
  User,
  DollarSign,
  Save,
  Loader2,
  X,
  CreditCard,
  Banknote,
  Building,
  CheckCircle2,
} from "lucide-react";
import {
  COWORKING_RESOURCES,
  CoworkingResourceType,
  calculateHoursBetween,
} from "@/lib/coworking-types";

interface Specialist {
  id: string;
  full_name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
}

interface Props {
  today: string;
  initialResource?: CoworkingResourceType;
  catalogRates?: Record<string, number>;
  specialists: Specialist[];
  createRental: (formData: FormData) => Promise<{ success?: boolean; error?: string; id?: string; rentalDate?: string }>;
}

export default function NuevaReservaClientForm({
  today,
  initialResource = "puesto_trabajo",
  catalogRates,
  specialists,
  createRental,
}: Props) {
  const router = useRouter();

  const [resource, setResource] = useState<CoworkingResourceType>(initialResource);
  const [resourceId, setResourceId] = useState("Sillón 1");
  const [rentalDate, setRentalDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");

  // Tarifas del catálogo de servicios
  const defaultRate =
    catalogRates?.[initialResource] ||
    COWORKING_RESOURCES[initialResource]?.defaultRate ||
    20.0;
  const [hourlyRate, setHourlyRate] = useState<number>(defaultRate);

  // Doctor
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [doctorDocument, setDoctorDocument] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  // Anticipo
  const [hasDeposit, setHasDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>("efectivo");
  const [depositNotes, setDepositNotes] = useState<string>("");

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hours = calculateHoursBetween(startTime, endTime);
  const calculatedTotal = Math.round(hours * hourlyRate * 100) / 100;
  const numDeposit = hasDeposit ? Number(depositAmount) || 0 : 0;
  const remainingBalance = Math.max(0, Math.round((calculatedTotal - numDeposit) * 100) / 100);

  function handleSelectResource(type: CoworkingResourceType) {
    setResource(type);
    const rate = catalogRates?.[type] || COWORKING_RESOURCES[type].defaultRate;
    setHourlyRate(rate);
    if (type === "clinica_completa") setResourceId("Toda la Clínica");
    else if (type === "aula_pequena") setResourceId("Aula A");
    else if (type === "aula_grande") setResourceId("Auditorio");
    else setResourceId("Sillón 1");
  }

  function handleSelectSpecialist(e: React.ChangeEvent<HTMLSelectElement>) {
    const sId = e.target.value;
    setSelectedDoctorId(sId);
    if (!sId) return;

    const spec = specialists.find((s) => s.id === sId);
    if (spec) {
      setDoctorName(spec.full_name);
      if (spec.phone) setDoctorPhone(spec.phone);
      if (spec.document_number) setDoctorDocument(spec.document_number);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (!doctorName.trim()) {
      setErrorMsg("El nombre del doctor es obligatorio.");
      return;
    }

    if (hasDeposit && numDeposit > calculatedTotal) {
      setErrorMsg("El anticipo no puede ser mayor al precio total del alquiler.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("resource_type", resource);
      formData.set("resource_identifier", resourceId.trim());
      formData.set("rental_date", rentalDate);
      formData.set("start_time", startTime);
      formData.set("end_time", endTime);
      formData.set("hours", hours.toString());
      formData.set("rate_type", "hora");
      formData.set("hourly_rate", hourlyRate.toString());
      formData.set("total_price", calculatedTotal.toString());

      formData.set("doctor_name", doctorName.trim());
      formData.set("doctor_document", doctorDocument.trim());
      formData.set("doctor_phone", doctorPhone.trim());
      formData.set("doctor_id", selectedDoctorId || "");

      // Anticipo
      if (hasDeposit && numDeposit > 0) {
        formData.set("deposit_amount", numDeposit.toString());
        formData.set("deposit_payment_method", depositPaymentMethod);
        formData.set("deposit_notes", depositNotes.trim());
      } else {
        formData.set("deposit_amount", "0");
      }

      formData.set("notes", notes.trim());

      const res = await createRental(formData);
      if (res?.success) {
        router.push(`/erp/coworking?date=${res.rentalDate || rentalDate}`);
        router.refresh();
      } else if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setErrorMsg(err.message || "Error al registrar la reserva.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white border border-lilac-100 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6"
    >
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-2xl font-medium flex items-center justify-between shadow-2xs">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 1. Espacio a Alquilar ── */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">
          Espacio a Reservar
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(Object.keys(COWORKING_RESOURCES) as CoworkingResourceType[]).map((key) => {
            const item = COWORKING_RESOURCES[key];
            const isSelected = resource === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectResource(key)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? "border-lilac-600 bg-lilac-50/70 shadow-xs ring-1 ring-lilac-600"
                    : "border-lilac-100 bg-white hover:border-lilac-300 hover:bg-lilac-50/30"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      isSelected ? "bg-lilac-600 text-white" : "bg-lilac-100 text-lilac-700"
                    }`}
                  >
                    {key === "puesto_trabajo" && <Stethoscope size={14} />}
                    {key === "clinica_completa" && <Building2 size={14} />}
                    {key === "aula_pequena" && <Presentation size={14} />}
                    {key === "aula_grande" && <GraduationCap size={14} />}
                  </div>
                </div>
                <span className="text-xs font-bold text-ink-900 leading-tight">
                  {item.shortName}
                </span>
              </button>
            );
          })}
        </div>

        {/* Detalle o número de puesto */}
        <div className="pt-1">
          <label className="text-[10px] font-semibold text-ink-500 block mb-1">
            Ubicación / Identificador específico (opcional):
          </label>
          <input
            type="text"
            className="w-full text-xs px-3 py-2 bg-lilac-50/40 border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 text-ink-800"
            placeholder={
              resource === "puesto_trabajo"
                ? "Ej: Sillón 1, Box Quirúrgico"
                : resource === "clinica_completa"
                ? "Ej: Toda la Clínica"
                : "Ej: Aula A, Auditorio"
            }
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          />
        </div>
      </div>

      {/* ── 2. Doctor o Profesional Arrendatario ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">
            Doctor / Arrendatario *
          </label>
          {specialists.length > 0 && (
            <span className="text-[10px] text-ink-400">
              O elige de la lista de doctores registrados:
            </span>
          )}
        </div>

        {specialists.length > 0 && (
          <select
            className="w-full text-xs px-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 text-ink-800 mb-2"
            value={selectedDoctorId}
            onChange={handleSelectSpecialist}
          >
            <option value="">-- Seleccionar doctor registrado (opcional) --</option>
            {specialists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} {s.specialty ? `(${s.specialty})` : ""}
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <input
              type="text"
              required
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-500 text-ink-900 font-semibold"
              placeholder="Nombre completo del Doctor *"
              value={doctorName}
              onChange={(e) => {
                setDoctorName(e.target.value);
                if (selectedDoctorId) setSelectedDoctorId("");
              }}
            />
          </div>
          <div>
            <input
              type="tel"
              className="w-full text-xs px-3.5 py-2.5 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-500 text-ink-800"
              placeholder="Teléfono / Celular"
              value={doctorPhone}
              onChange={(e) => setDoctorPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── 3. Fecha y Horario ── */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-ink-700 uppercase tracking-wider block">
          Fecha y Horario
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="text-[10px] font-semibold text-ink-500 block mb-1">
              Fecha de Reserva
            </label>
            <div className="relative">
              <Calendar
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
              />
              <input
                type="date"
                required
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 font-mono text-ink-800"
                value={rentalDate}
                onChange={(e) => setRentalDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-ink-500 block mb-1">
              Hora Inicio
            </label>
            <div className="relative">
              <Clock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
              />
              <input
                type="time"
                required
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 font-mono text-ink-800"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-ink-500 block mb-1">
              Hora Fin
            </label>
            <div className="relative">
              <Clock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
              />
              <input
                type="time"
                required
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 font-mono text-ink-800"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-ink-600 px-1 pt-0.5">
          <span>
            Duración calculada: <strong className="text-ink-900 font-bold text-sm">{hours} {hours === 1 ? "hora" : "horas"}</strong> ({startTime} a {endTime})
          </span>
          <span className="text-[11px] text-ink-400">
            Costos según Catálogo de Servicios
          </span>
        </div>
      </div>

      {/* ── 4. Anticipo Opcional ── */}
      <div className="bg-lilac-50/40 border border-lilac-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasDeposit}
              onChange={(e) => {
                setHasDeposit(e.target.checked);
                if (!e.target.checked) setDepositAmount("");
              }}
              className="w-4 h-4 text-lilac-600 rounded border-lilac-300 focus:ring-lilac-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-ink-800">
              ¿Registrar un anticipo del doctor para esta reserva?
            </span>
          </label>
          {hasDeposit && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Anticipo activo
            </span>
          )}
        </div>

          {hasDeposit && (
            <div className="bg-white border border-lilac-200/80 rounded-2xl p-3.5 space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-ink-600 uppercase tracking-wider block mb-1">
                    Monto de Anticipo ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 font-bold text-xs pointer-events-none">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={calculatedTotal}
                      required={hasDeposit}
                      placeholder="0.00"
                      className="w-full text-xs pl-7 pr-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono font-bold text-emerald-700"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-ink-600 uppercase tracking-wider block mb-1">
                    Forma de Pago del Anticipo
                  </label>
                  <select
                    className="w-full text-xs px-3 py-2 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 text-ink-800"
                    value={depositPaymentMethod}
                    onChange={(e) => setDepositPaymentMethod(e.target.value)}
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="transferencia">🏦 Transferencia / Depósito</option>
                    <option value="tarjeta_credito">💳 Tarjeta de Crédito / Débito</option>
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Referencia o notas del anticipo (ej: Transf. Banco Pichincha #4829)"
                  className="w-full text-xs px-3 py-1.5 bg-lilac-50/30 border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 text-ink-700"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                />
              </div>

              {/* Resumen de saldo pendiente */}
              <div className="flex items-center justify-between text-xs pt-1 px-1 border-t border-lilac-50">
                <span className="text-ink-600">
                  Saldo a facturar / cobrar el día del alquiler:
                </span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  ${remainingBalance.toFixed(2)}
                </span>
              </div>
            </div>
          )}
      </div>

      {/* ── 5. Observaciones Rápidas (Opcional) ── */}
      <div>
        <label className="text-[11px] font-semibold text-ink-600 block mb-1">
          Observaciones adicionales (opcional):
        </label>
        <textarea
          rows={2}
          className="w-full text-xs p-3 bg-white border border-lilac-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-lilac-500 text-ink-800"
          placeholder="Ej: Doctor requiere lámpara de fotocurado adicional y uso del autoclave."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* ── Botón Guardar ── */}
      <div className="pt-2 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push(`/erp/coworking?date=${rentalDate}`)}
          className="px-4 py-2 text-xs font-semibold text-ink-600 hover:text-ink-900 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white text-xs sm:text-sm font-bold px-6 py-2.5 rounded-xl shadow-xs transition active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Guardando reserva...
            </>
          ) : (
            <>
              <Save size={16} /> Confirmar Reserva
            </>
          )}
        </button>
      </div>
    </form>
  );
}
