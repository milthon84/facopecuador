"use client";

import { useState } from "react";
import {
  Building2,
  Stethoscope,
  GraduationCap,
  Presentation,
  Calendar,
  Clock,
  User,
  Save,
  Loader2,
  X,
  FileText,
  DollarSign,
  Sparkles,
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
  specialists: Specialist[];
  createRental: (formData: FormData) => Promise<{ success?: boolean; error?: string; id?: string }>;
}

export default function NuevaReservaClientForm({ today, specialists, createRental }: Props) {
  const [resource, setResource] = useState<CoworkingResourceType>("puesto_trabajo");
  const [resourceId, setResourceId] = useState("");
  const [rentalDate, setRentalDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");

  const [rateType, setRateType] = useState<"hora" | "turno" | "dia" | "evento">("hora");
  const [hourlyRate, setHourlyRate] = useState<number>(COWORKING_RESOURCES.puesto_trabajo.defaultRate);
  const [customTotal, setCustomTotal] = useState<string>("");

  const [doctorName, setDoctorName] = useState("");
  const [doctorDocument, setDoctorDocument] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorSpecialty, setDoctorSpecialty] = useState("");
  const [doctorReg, setDoctorReg] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hours = calculateHoursBetween(startTime, endTime);
  const calculatedTotal =
    rateType === "hora" ? Math.round(hours * hourlyRate * 100) / 100 : Number(customTotal) || 0;

  function handleSelectResource(type: CoworkingResourceType) {
    setResource(type);
    setHourlyRate(COWORKING_RESOURCES[type].defaultRate);
    if (type === "clinica_completa") setResourceId("Toda la Clínica");
    else if (type === "aula_pequena") setResourceId("Aula A");
    else if (type === "aula_grande") setResourceId("Auditorio Principal");
    else setResourceId("Sillón 1");
  }

  function handleSelectSpecialist(e: React.ChangeEvent<HTMLSelectElement>) {
    const sId = e.target.value;
    setSelectedDoctorId(sId);
    if (!sId) return;

    const spec = specialists.find((s) => s.id === sId);
    if (spec) {
      setDoctorName(spec.full_name);
      if (spec.document_number) setDoctorDocument(spec.document_number);
      if (spec.phone) setDoctorPhone(spec.phone);
      if (spec.email) setDoctorEmail(spec.email);
      if (spec.specialty) setDoctorSpecialty(spec.specialty);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (!doctorName.trim()) {
      setErrorMsg("El nombre del doctor o arrendatario es obligatorio.");
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
      formData.set("rate_type", rateType);
      formData.set("hourly_rate", hourlyRate.toString());
      formData.set("total_price", calculatedTotal.toString());

      formData.set("doctor_name", doctorName.trim());
      formData.set("doctor_document", doctorDocument.trim());
      formData.set("doctor_phone", doctorPhone.trim());
      formData.set("doctor_email", doctorEmail.trim());
      formData.set("doctor_specialty", doctorSpecialty.trim());
      formData.set("doctor_registration_number", doctorReg.trim());
      formData.set("doctor_id", selectedDoctorId || "");
      formData.set("notes", notes.trim());

      const res = await createRental(formData);
      if (res?.success && res.id) {
        window.location.href = `/erp/coworking/${res.id}`;
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
    <form onSubmit={handleSubmit} noValidate className="bg-white border border-lilac-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Selección del Espacio / Recurso */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-ink-700 uppercase tracking-wide block">
          1. Selecciona el Espacio o Recurso a Reservar *
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {(Object.keys(COWORKING_RESOURCES) as CoworkingResourceType[]).map((key) => {
            const res = COWORKING_RESOURCES[key];
            const isSelected = resource === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectResource(key)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 ${
                  isSelected
                    ? "border-lilac-500 bg-lilac-50/70 ring-2 ring-lilac-200 shadow-xs"
                    : "border-lilac-200 bg-white hover:bg-lilac-50/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                    isSelected ? "bg-lilac-600 text-white" : "bg-lilac-100 text-lilac-700"
                  }`}>
                    {key === "puesto_trabajo" && <Stethoscope size={16} />}
                    {key === "clinica_completa" && <Building2 size={16} />}
                    {key === "aula_pequena" && <Presentation size={16} />}
                    {key === "aula_grande" && <GraduationCap size={16} />}
                  </div>
                  <span className="text-xs font-bold font-mono text-ink-700">
                    ${res.defaultRate}/h
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-ink-900">{res.name}</h4>
                  <p className="text-[11px] text-ink-500 line-clamp-2 mt-0.5">{res.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Fecha, Horario e Identificador */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-lilac-100">
        <div className="sm:col-span-4 space-y-1">
          <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
            <Calendar size={13} className="text-ink-400" /> Fecha de Reserva *
          </label>
          <input
            type="date"
            required
            value={rentalDate}
            onChange={(e) => setRentalDate(e.target.value)}
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
            <Clock size={13} className="text-ink-400" /> Hora Inicio *
          </label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        <div className="sm:col-span-3 space-y-1">
          <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
            <Clock size={13} className="text-ink-400" /> Hora Fin *
          </label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-semibold text-ink-700">Identificador</label>
          <input
            type="text"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            placeholder="Ej. Sillón 1"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>
      </div>

      {/* 3. Datos del Doctor / Arrendatario */}
      <div className="space-y-3 pt-2 border-t border-lilac-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-ink-700 uppercase tracking-wide block">
            2. Datos del Doctor / Arrendatario
          </label>
          {specialists.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-500">¿Especialista registrado?</span>
              <select
                value={selectedDoctorId}
                onChange={handleSelectSpecialist}
                className="border border-lilac-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-lilac-800 bg-lilac-50/50 focus:outline-none focus:ring-2 focus:ring-lilac-400"
              >
                <option value="">— Elegir de lista —</option>
                {specialists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.specialty ? `(${s.specialty})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-7 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Nombre Completo del Doctor *</label>
            <input
              type="text"
              required
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Juan Pérez"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium text-ink-900"
            />
          </div>

          <div className="sm:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Cédula o RUC</label>
            <input
              type="text"
              maxLength={13}
              value={doctorDocument}
              onChange={(e) => setDoctorDocument(e.target.value)}
              placeholder="1712345678"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Teléfono / WhatsApp</label>
            <input
              type="text"
              value={doctorPhone}
              onChange={(e) => setDoctorPhone(e.target.value)}
              placeholder="0991234567"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Correo Electrónico</label>
            <input
              type="email"
              value={doctorEmail}
              onChange={(e) => setDoctorEmail(e.target.value)}
              placeholder="doctor@ejemplo.com"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Especialidad</label>
            <input
              type="text"
              value={doctorSpecialty}
              onChange={(e) => setDoctorSpecialty(e.target.value)}
              placeholder="Ej. Endodoncia, Ortodoncia..."
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
            />
          </div>
        </div>
      </div>

      {/* 4. Tarifa y Valor Acordado */}
      <div className="bg-lilac-50/40 border border-lilac-100 rounded-2xl p-4 space-y-3">
        <label className="text-xs font-bold text-ink-700 uppercase tracking-wide block">
          3. Tarifa y Condiciones de Pago
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-4 space-y-1">
            <span className="text-[11px] font-semibold text-ink-600 block">Tipo de Cobro</span>
            <div className="flex gap-1.5">
              {[
                { id: "hora", label: "Por Hora" },
                { id: "turno", label: "Turno Fijo" },
                { id: "dia", label: "Día Completo" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRateType(t.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    rateType === t.id
                      ? "bg-lilac-600 text-white font-bold shadow-xs"
                      : "bg-white text-ink-600 border border-lilac-200 hover:bg-lilac-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {rateType === "hora" ? (
            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Tarifa por Hora ($)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-sm font-mono font-bold bg-white text-ink-900"
              />
              <span className="text-[10px] text-ink-400">Duración: {hours} horas</span>
            </div>
          ) : (
            <div className="sm:col-span-4 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Monto Total Acordado ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={customTotal}
                onChange={(e) => setCustomTotal(e.target.value)}
                placeholder="50.00"
                className="w-full border border-lilac-200 rounded-xl px-3 py-1.5 text-sm font-mono font-bold bg-white text-ink-900"
              />
            </div>
          )}

          <div className="sm:col-span-4 text-left sm:text-right">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Total a Facturar
            </span>
            <span className="text-2xl font-black text-lilac-700 font-mono">
              ${calculatedTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Notas Adicionales */}
      <div className="space-y-1 pt-1">
        <label className="text-xs font-semibold text-ink-700">Observaciones / Requerimientos Especiales</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Requiere micromotor y cavitrón, paciente llega a las 09:30"
          className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
        />
      </div>

      {/* 6. Botones */}
      <div className="pt-3 border-t border-lilac-100 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-lilac-50 rounded-xl transition"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-lilac-200 transition active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Guardando...
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
