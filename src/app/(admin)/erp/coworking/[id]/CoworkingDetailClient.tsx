"use client";

import { useState, useRef, ChangeEvent } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Award,
  FileCheck2,
  FileText,
  UploadCloud,
  Eye,
  Trash2,
  Receipt,
  PlayCircle,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
  ExternalLink,
  X,
  Stethoscope,
  GraduationCap,
  Presentation,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  CoworkingRental,
  COWORKING_RESOURCES,
  COWORKING_STATUS_CONFIG,
  CoworkingRentalStatus,
} from "@/lib/coworking-types";
import { proxyStorageUrl } from "@/lib/storage-proxy";

interface Props {
  rental: CoworkingRental;
  canEdit: boolean;
  updateDoctorInfo: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  uploadDocument: (formData: FormData) => Promise<{ success?: boolean; error?: string; url?: string }>;
  removeDocument: (type: "contract" | "waiver") => Promise<{ success?: boolean; error?: string }>;
  changeStatus: (newStatus: CoworkingRentalStatus) => Promise<{ success?: boolean; error?: string }>;
}

export default function CoworkingDetailClient({
  rental,
  canEdit,
  updateDoctorInfo,
  uploadDocument,
  removeDocument,
  changeStatus,
}: Props) {
  // Estados de datos del doctor
  const [doctorName, setDoctorName] = useState(rental.doctor_name || "");
  const [doctorDocument, setDoctorDocument] = useState(rental.doctor_document || "");
  const [doctorPhone, setDoctorPhone] = useState(rental.doctor_phone || "");
  const [doctorEmail, setDoctorEmail] = useState(rental.doctor_email || "");
  const [doctorSpecialty, setDoctorSpecialty] = useState(rental.doctor_specialty || "");
  const [doctorReg, setDoctorReg] = useState(rental.doctor_registration_number || "");

  // Datos del paciente
  const [patientName, setPatientName] = useState(rental.patient_name || "");
  const [patientDocument, setPatientDocument] = useState(rental.patient_document || "");
  const [notes, setNotes] = useState(rental.notes || "");

  // Modales y cargas
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<"contract" | "waiver" | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const contractInputRef = useRef<HTMLInputElement>(null);
  const waiverInputRef = useRef<HTMLInputElement>(null);

  const resConfig = COWORKING_RESOURCES[rental.resource_type] || COWORKING_RESOURCES.puesto_trabajo;
  const statusConfig = COWORKING_STATUS_CONFIG[rental.status] || COWORKING_STATUS_CONFIG.reservado;

  const dateStr = new Date(rental.rental_date + "T12:00:00").toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Guardar datos del doctor y paciente
  async function handleSaveDoctor(e: React.FormEvent) {
    e.preventDefault();
    setSavingDoctor(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.set("id", rental.id);
      formData.set("doctor_name", doctorName.trim());
      formData.set("doctor_document", doctorDocument.trim());
      formData.set("doctor_phone", doctorPhone.trim());
      formData.set("doctor_email", doctorEmail.trim());
      formData.set("doctor_specialty", doctorSpecialty.trim());
      formData.set("doctor_registration_number", doctorReg.trim());
      formData.set("patient_name", patientName.trim());
      formData.set("patient_document", patientDocument.trim());
      formData.set("notes", notes.trim());

      const res = await updateDoctorInfo(formData);
      if (res?.success) {
        setMsg({ type: "success", text: "Datos del doctor y atención actualizados correctamente." });
      } else {
        setMsg({ type: "error", text: res?.error || "Error al actualizar los datos." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al guardar." });
    } finally {
      setSavingDoctor(false);
    }
  }

  // Manejador de subida de archivos
  async function handleFileUpload(file: File, type: "contract" | "waiver") {
    if (!file) return;
    setUploadingDocType(type);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.set("id", rental.id);
      formData.set("type", type);
      formData.set("file", file);

      const res = await uploadDocument(formData);
      if (res?.success) {
        setMsg({
          type: "success",
          text: type === "contract" ? "Contrato cargado exitosamente." : "Descargo de responsabilidad cargado exitosamente.",
        });
        window.location.reload();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al subir documento." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al subir archivo." });
    } finally {
      setUploadingDocType(null);
    }
  }

  // Manejador de eliminación de archivo
  async function handleRemoveDoc(type: "contract" | "waiver") {
    if (!confirm(`¿Estás seguro de quitar este documento?`)) return;
    try {
      const res = await removeDocument(type);
      if (res?.success) {
        window.location.reload();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al eliminar archivo." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
  }

  // Cambio de estado
  async function handleStatusChange(newStatus: CoworkingRentalStatus) {
    setChangingStatus(true);
    setMsg(null);
    try {
      const res = await changeStatus(newStatus);
      if (res?.success) {
        window.location.reload();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al cambiar estado." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setChangingStatus(false);
    }
  }

  const deposit = Number(rental.deposit_amount || 0);
  const total = Number(rental.total_price || 0);
  const balance = Math.max(0, Math.round((total - deposit) * 100) / 100);
  const invoicePrice = balance > 0 ? balance : total;
  const invoiceDesc = `Alquiler ${resConfig.name} - ${rental.rental_date} (${rental.start_time.slice(0, 5)} a ${rental.end_time.slice(0, 5)})${
    deposit > 0 ? ` [Anticipo previo registrado: $${deposit.toFixed(2)}]` : ""
  }`;

  const invoiceLink = `/erp/facturacion/nueva?client_name=${encodeURIComponent(doctorName || rental.doctor_name)}&client_document=${encodeURIComponent(doctorDocument || rental.doctor_document || "")}&client_email=${encodeURIComponent(doctorEmail || rental.doctor_email || "")}&client_phone=${encodeURIComponent(doctorPhone || rental.doctor_phone || "")}&item_description=${encodeURIComponent(invoiceDesc)}&item_price=${invoicePrice}&rental_id=${rental.id}&return_url=${encodeURIComponent(`/erp/coworking/${rental.id}`)}`;

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs ${
          msg.type === "success"
            ? "bg-teal-50 border border-teal-200 text-teal-900"
            : "bg-red-50 border border-red-200 text-red-900"
        }`}>
          <span>{msg.type === "success" ? "✓" : "⚠️"} {msg.text}</span>
          <button type="button" onClick={() => setMsg(null)} className="p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 1. Resumen de la Reserva y Barra de Estado ── */}
      <div className="bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border ${resConfig.badgeColor}`}>
                {rental.resource_type === "puesto_trabajo" && <Stethoscope size={13} />}
                {rental.resource_type === "clinica_completa" && <Building2 size={13} />}
                {rental.resource_type === "aula_pequena" && <Presentation size={13} />}
                {rental.resource_type === "aula_grande" && <GraduationCap size={13} />}
                {resConfig.name}
              </span>
              {rental.resource_identifier && (
                <span className="text-xs font-mono font-semibold text-ink-700 bg-lilac-50 border border-lilac-200 px-2 py-0.5 rounded-lg">
                  {rental.resource_identifier}
                </span>
              )}
            </div>
            <p className="text-xs text-ink-500 capitalize">{dateStr}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.badgeCls}`}>
              {statusConfig.label}
            </span>

            {/* Acciones de cambio de estado */}
            {canEdit && rental.status !== "facturado" && (
              <div className="flex items-center gap-1.5">
                {rental.status === "reservado" && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange("en_curso")}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-xl shadow-xs transition"
                  >
                    <PlayCircle size={13} /> Iniciar Atención
                  </button>
                )}
                {rental.status === "en_curso" && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange("finalizado")}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-xl shadow-xs transition"
                  >
                    <CheckCircle size={13} /> Finalizar Atención
                  </button>
                )}
                {rental.status !== "cancelado" && rental.status !== "finalizado" && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => {
                      if (confirm("¿Deseas cancelar esta reserva?")) handleStatusChange("cancelado");
                    }}
                    className="text-xs text-red-600 hover:text-red-800 hover:underline px-2 py-1"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Datos clave de horario y tarifa */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-lilac-50/40 p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Horario</span>
            <span className="font-mono font-bold text-ink-900 text-sm mt-0.5 block">
              {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
            </span>
            <span className="text-[11px] text-ink-500">Duración: {rental.hours} horas</span>
          </div>

          <div className="bg-lilac-50/40 p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Total Acordado</span>
            <span className="font-mono font-black text-ink-900 text-base mt-0.5 block">
              ${total.toFixed(2)}
            </span>
            <span className="text-[10px] text-ink-500">Tarifa: ${rental.hourly_rate}/h</span>
          </div>

          <div className="bg-lilac-50/40 p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">
              {deposit > 0 ? "Anticipo & Saldo" : "Cobro / Saldo"}
            </span>
            {deposit > 0 ? (
              <div>
                <span className="font-mono font-bold text-emerald-700 text-xs block">
                  ✓ Anticipo: ${deposit.toFixed(2)}
                </span>
                <span className="font-mono font-bold text-amber-800 text-xs block mt-0.5">
                  Saldo pendiente: ${balance.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="font-mono font-bold text-ink-700 text-sm mt-0.5 block">
                Total por pagar: ${total.toFixed(2)}
              </span>
            )}
          </div>

          <div className="bg-lilac-50/40 p-3 rounded-xl border border-lilac-100/60 flex flex-col justify-between">
            <span className="text-[10px] text-ink-400 font-bold uppercase tracking-wider block">Facturación SRI</span>
            {rental.invoice_id || rental.status === "facturado" ? (
              <div>
                <span className="font-mono font-bold text-teal-800 text-xs block truncate">
                  Fac #{rental.invoice_number || "Emitida"}
                </span>
                <Link
                  href={`/erp/facturacion/${rental.invoice_id}`}
                  className="text-[11px] font-bold text-lilac-700 hover:underline"
                >
                  Ver factura SRI →
                </Link>
              </div>
            ) : (
              <div>
                <span className="text-[11px] text-amber-700 font-semibold block">Pendiente de facturar</span>
                <Link
                  href={invoiceLink}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-lilac-700 hover:underline mt-0.5"
                >
                  <Receipt size={12} /> Facturar ahora →
                </Link>
              </div>
            )}
          </div>
        </div>

        {deposit > 0 && (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-900 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">✓ Anticipo Registrado:</span>
              <span className="font-mono font-bold">${deposit.toFixed(2)}</span>
              {rental.deposit_payment_method && (
                <span className="capitalize text-emerald-700 font-medium">({rental.deposit_payment_method})</span>
              )}
              {rental.deposit_notes && (
                <span className="text-ink-600 italic">— Ref: {rental.deposit_notes}</span>
              )}
            </div>
            <div className="font-mono font-bold text-amber-800">
              Saldo restante por cobrar: ${balance.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. SECCIÓN DE DOCUMENTOS (CONTRATO Y DESCARGO DE RESPONSABILIDAD) ── */}
      <div className="bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-lilac-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                Documentación Requerida para la Atención
              </h2>
              <p className="text-[11px] text-ink-500">
                Contrato de arrendamiento del espacio y descargo de responsabilidad firmado por el paciente
              </p>
            </div>
          </div>
        </div>

        <input
          ref={contractInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, "contract");
          }}
        />
        <input
          ref={waiverInputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, "waiver");
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Card: Contrato de Alquiler */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <FileCheck2 size={20} className={rental.contract_url ? "text-teal-600" : "text-ink-400"} />
                <div>
                  <h4 className="text-xs font-bold text-ink-900">Contrato de Arrendamiento</h4>
                  <p className="text-[11px] text-ink-500">Firmado por el doctor arrendatario</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                rental.contract_url
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {rental.contract_url ? "Cargado" : "Pendiente"}
              </span>
            </div>

            {rental.contract_url ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs bg-white border border-lilac-100 p-2 rounded-lg">
                  <span className="font-mono text-ink-700 truncate max-w-[180px]">
                    Contrato digital adjunto
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl(proxyStorageUrl(rental.contract_url));
                        setPreviewTitle("Contrato de Arrendamiento");
                      }}
                      className="p-1 text-lilac-700 hover:text-lilac-900"
                      title="Ver documento"
                    >
                      <Eye size={15} />
                    </button>
                    <a
                      href={proxyStorageUrl(rental.contract_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-lilac-700 hover:text-lilac-900"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink size={14} />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc("contract")}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => contractInputRef.current?.click()}
                    disabled={uploadingDocType === "contract"}
                    className="text-[11px] text-lilac-700 hover:underline font-semibold block text-center w-full"
                  >
                    Reemplazar contrato
                  </button>
                )}
              </div>
            ) : (
              canEdit && (
                <button
                  type="button"
                  disabled={uploadingDocType === "contract"}
                  onClick={() => contractInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-lilac-300 hover:border-lilac-400 bg-white hover:bg-lilac-50 text-lilac-800 text-xs font-bold py-2.5 rounded-xl transition shadow-2xs"
                >
                  {uploadingDocType === "contract" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Subiendo...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} className="text-lilac-600" /> Subir Contrato (PDF o Foto)
                    </>
                  )}
                </button>
              )
            )}
          </div>

          {/* Card: Descargo de Responsabilidad */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className={rental.waiver_url ? "text-teal-600" : "text-ink-400"} />
                <div>
                  <h4 className="text-xs font-bold text-ink-900">Descargo de Responsabilidad</h4>
                  <p className="text-[11px] text-ink-500">Firmado por el paciente atendido</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                rental.waiver_url
                  ? "bg-teal-50 text-teal-800 border-teal-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {rental.waiver_url ? "Cargado" : "Pendiente"}
              </span>
            </div>

            {rental.waiver_url ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs bg-white border border-lilac-100 p-2 rounded-lg">
                  <span className="font-mono text-ink-700 truncate max-w-[180px]">
                    Descargo firmado adjunto
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewUrl(proxyStorageUrl(rental.waiver_url));
                        setPreviewTitle("Descargo de Responsabilidad del Paciente");
                      }}
                      className="p-1 text-lilac-700 hover:text-lilac-900"
                      title="Ver documento"
                    >
                      <Eye size={15} />
                    </button>
                    <a
                      href={proxyStorageUrl(rental.waiver_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-lilac-700 hover:text-lilac-900"
                      title="Abrir en pestaña nueva"
                    >
                      <ExternalLink size={14} />
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc("waiver")}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => waiverInputRef.current?.click()}
                    disabled={uploadingDocType === "waiver"}
                    className="text-[11px] text-lilac-700 hover:underline font-semibold block text-center w-full"
                  >
                    Reemplazar descargo
                  </button>
                )}
              </div>
            ) : (
              canEdit && (
                <button
                  type="button"
                  disabled={uploadingDocType === "waiver"}
                  onClick={() => waiverInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-lilac-300 hover:border-lilac-400 bg-white hover:bg-lilac-50 text-lilac-800 text-xs font-bold py-2.5 rounded-xl transition shadow-2xs"
                >
                  {uploadingDocType === "waiver" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Subiendo...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} className="text-lilac-600" /> Subir Descargo (PDF o Foto)
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── 3. CHECK-IN / FORMULARIO DE DATOS DEL DOCTOR Y PACIENTE ── */}
      <form onSubmit={handleSaveDoctor} className="bg-white border border-lilac-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-lilac-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-lilac-50 text-lilac-700 flex items-center justify-center font-bold">
              <User size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                Datos del Doctor Arrendatario y Paciente (Check-in)
              </h2>
              <p className="text-[11px] text-ink-500">
                Completa o actualiza la información fiscal y profesional antes o durante la atención
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={savingDoctor}
              className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-xs transition disabled:opacity-50"
            >
              {savingDoctor ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={14} /> Guardar Datos
                </>
              )}
            </button>
          )}
        </div>

        {/* Inputs del Doctor */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Nombre Completo del Doctor *</label>
            <input
              type="text"
              required
              disabled={!canEdit}
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white font-medium text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-6 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Cédula o RUC *</label>
            <input
              type="text"
              maxLength={13}
              disabled={!canEdit}
              value={doctorDocument}
              onChange={(e) => setDoctorDocument(e.target.value)}
              placeholder="1790483851001"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Teléfono / Celular</label>
            <input
              type="text"
              disabled={!canEdit}
              value={doctorPhone}
              onChange={(e) => setDoctorPhone(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Correo Electrónico</label>
            <input
              type="email"
              disabled={!canEdit}
              value={doctorEmail}
              onChange={(e) => setDoctorEmail(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Especialidad</label>
            <input
              type="text"
              disabled={!canEdit}
              value={doctorSpecialty}
              onChange={(e) => setDoctorSpecialty(e.target.value)}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Registro MSP / Senescyt</label>
            <input
              type="text"
              disabled={!canEdit}
              value={doctorReg}
              onChange={(e) => setDoctorReg(e.target.value)}
              placeholder="Ej. 1005-2022-12345"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          {/* Datos del Paciente atendido */}
          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Nombre del Paciente Atendido</label>
            <input
              type="text"
              disabled={!canEdit}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Paciente atendido en el turno"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Cédula del Paciente</label>
            <input
              type="text"
              maxLength={10}
              disabled={!canEdit}
              value={patientDocument}
              onChange={(e) => setPatientDocument(e.target.value)}
              placeholder="1712345678"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>
        </div>

        <div className="space-y-1 pt-1">
          <label className="text-xs font-semibold text-ink-700">Observaciones del Servicio</label>
          <input
            type="text"
            disabled={!canEdit}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas de instrumental, materiales utilizados o novedades"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
          />
        </div>
      </form>

      {/* ── 4. SECCIÓN DE FACTURACIÓN POST-ATENCIÓN ── */}
      <div className="bg-gradient-to-r from-lilac-50/90 via-indigo-50/50 to-teal-50/50 border border-lilac-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">
              {rental.status === "facturado" ? "Alquiler Facturado con SRI" : "Facturación de Alquiler / Coworking"}
            </h3>
            <p className="text-xs text-ink-500">
              {rental.status === "facturado"
                ? `Factura N° ${rental.invoice_number || "Registrada"} vinculada a esta reserva`
                : "Al terminar la atención, emite la factura electrónica SRI con los datos del doctor y el servicio precargados"}
            </p>
          </div>
        </div>

        {rental.status === "facturado" ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/erp/facturacion/${rental.invoice_id}`}
              className="inline-flex items-center gap-1.5 bg-white border border-teal-300 text-teal-800 text-xs font-bold px-4 py-2 rounded-xl shadow-2xs hover:bg-teal-50 transition"
            >
              <FileText size={14} /> Ver Factura
            </Link>
          </div>
        ) : (
          <Link
            href={invoiceLink}
            className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-lilac-200 transition active:scale-[0.99]"
          >
            <Receipt size={16} /> Emitir Factura SRI Ahora
          </Link>
        )}
      </div>

      {/* Modal Lightbox para previsualizar el documento */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-lilac-100 flex items-center justify-between bg-ink-50/60">
              <span className="text-xs font-bold text-ink-900">{previewTitle}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-lilac-700 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink size={13} /> Abrir original
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewUrl(null)}
                  className="w-7 h-7 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-ink-100/40">
              {previewUrl.toLowerCase().includes(".pdf") ? (
                <div className="text-center py-10 space-y-3">
                  <FileText size={48} className="text-red-600 mx-auto" />
                  <p className="text-xs font-bold text-ink-900">Documento PDF</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-semibold"
                  >
                    <ExternalLink size={14} /> Abrir y Descargar PDF
                  </a>
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className="max-h-[65vh] object-contain rounded-lg shadow-xs"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
