"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  AlertTriangle,
  FilePlus2,
  Plus,
} from "lucide-react";
import {
  CoworkingRental,
  COWORKING_RESOURCES,
  COWORKING_STATUS_CONFIG,
  CoworkingRentalStatus,
  CoworkingDocumentItem,
  parseCoworkingDocuments,
} from "@/lib/coworking-types";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import {
  updateDoctorInfoAction,
  uploadCoworkingDocumentAction,
  removeCoworkingDocumentAction,
  changeCoworkingStatusAction,
} from "../actions";

interface Props {
  rental: CoworkingRental;
  canEdit: boolean;
}

export default function CoworkingDetailClient({ rental, canEdit }: Props) {
  const router = useRouter();

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

  // Listas de documentos (múltiples)
  const [contracts, setContracts] = useState<CoworkingDocumentItem[]>(() =>
    parseCoworkingDocuments(rental.contract_url, "Contrato", rental.contract_uploaded_at)
  );
  const [waivers, setWaivers] = useState<CoworkingDocumentItem[]>(() =>
    parseCoworkingDocuments(rental.waiver_url, "Descargo", rental.waiver_uploaded_at)
  );

  // Estado actual del alquiler
  const [currentStatus, setCurrentStatus] = useState<CoworkingRentalStatus>(rental.status);

  // Modales y cargas
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<"contract" | "waiver" | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);

  // Modal de confirmación de cancelación
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  // Modal / advertencia de documentos requeridos al completar
  const [missingDocsModal, setMissingDocsModal] = useState<boolean>(false);

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const contractInputRef = useRef<HTMLInputElement>(null);
  const waiverInputRef = useRef<HTMLInputElement>(null);
  const docsSectionRef = useRef<HTMLDivElement>(null);

  const resConfig = COWORKING_RESOURCES[rental.resource_type] || COWORKING_RESOURCES.puesto_trabajo;
  const statusConfig = COWORKING_STATUS_CONFIG[currentStatus] || COWORKING_STATUS_CONFIG.reservado;

  const isClinicalSpace =
    rental.resource_type === "puesto_trabajo" || rental.resource_type === "clinica_completa";

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

      const res = await updateDoctorInfoAction(formData);
      if (res?.success) {
        setMsg({ type: "success", text: "Datos del doctor y atención actualizados correctamente." });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al actualizar los datos." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al guardar." });
    } finally {
      setSavingDoctor(false);
    }
  }

  // Subir uno o varios archivos
  async function handleFileUpload(files: FileList | null, type: "contract" | "waiver") {
    if (!files || files.length === 0) return;
    setUploadingDocType(type);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.set("id", rental.id);
      formData.set("type", type);
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await uploadCoworkingDocumentAction(formData);
      if (res?.success && res.documents) {
        if (type === "contract") {
          setContracts(res.documents);
        } else {
          setWaivers(res.documents);
        }
        setMsg({
          type: "success",
          text:
            type === "contract"
              ? `${files.length > 1 ? "Contratos cargados" : "Contrato cargado"} exitosamente.`
              : `${files.length > 1 ? "Descargos cargados" : "Descargo cargado"} exitosamente.`,
        });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al subir documentos." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al subir archivo." });
    } finally {
      setUploadingDocType(null);
      if (contractInputRef.current) contractInputRef.current.value = "";
      if (waiverInputRef.current) waiverInputRef.current.value = "";
    }
  }

  // Eliminar un documento específico
  async function handleRemoveDoc(type: "contract" | "waiver", docId: string, docName: string) {
    if (!confirm(`¿Estás seguro de eliminar el documento "${docName}"?`)) return;
    try {
      const res = await removeCoworkingDocumentAction(rental.id, type, docId);
      if (res?.success && res.remainingDocs) {
        if (type === "contract") {
          setContracts(res.remainingDocs);
        } else {
          setWaivers(res.remainingDocs);
        }
        setMsg({ type: "success", text: "Documento eliminado correctamente." });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res?.error || "Error al eliminar documento." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al eliminar." });
    }
  }

  // Cambio de estado
  async function handleStatusChange(newStatus: CoworkingRentalStatus) {
    // Si intenta COMPLETAR alquiler y es espacio clínico, validar documentos
    if (newStatus === "finalizado" && isClinicalSpace) {
      if (contracts.length === 0 || waivers.length === 0) {
        setMissingDocsModal(true);
        if (docsSectionRef.current) {
          docsSectionRef.current.scrollIntoView({ behavior: "smooth" });
        }
        return;
      }
    }

    setChangingStatus(true);
    setMsg(null);
    try {
      const res = await changeCoworkingStatusAction(rental.id, newStatus);
      if (res?.success) {
        setCurrentStatus(newStatus);
        setConfirmCancelOpen(false);
        setMsg({
          type: "success",
          text:
            newStatus === "finalizado"
              ? "¡Alquiler completado exitosamente! Ahora puedes emitir la factura electrónica."
              : newStatus === "cancelado"
              ? "El alquiler ha sido cancelado."
              : "Estado actualizado correctamente.",
        });
        router.refresh();
      } else {
        if (res?.missingDocs) {
          setMissingDocsModal(true);
          if (docsSectionRef.current) {
            docsSectionRef.current.scrollIntoView({ behavior: "smooth" });
          }
        }
        setMsg({ type: "error", text: res?.error || "Error al cambiar estado." });
      }
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Error al actualizar estado." });
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

  // URL para facturación con todos los datos precargados
  const invoiceLink = `/erp/facturacion/nueva?client_name=${encodeURIComponent(
    doctorName || rental.doctor_name || ""
  )}&client_document=${encodeURIComponent(
    doctorDocument || rental.doctor_document || ""
  )}&client_email=${encodeURIComponent(
    doctorEmail || rental.doctor_email || ""
  )}&client_phone=${encodeURIComponent(
    doctorPhone || rental.doctor_phone || ""
  )}&item_description=${encodeURIComponent(
    invoiceDesc
  )}&item_price=${invoicePrice}&rental_id=${rental.id}&return_url=${encodeURIComponent(
    `/erp/coworking/${rental.id}`
  )}`;

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between shadow-2xs ${
            msg.type === "success"
              ? "bg-teal-50 border border-teal-200 text-teal-900"
              : msg.type === "warning"
              ? "bg-amber-50 border border-amber-200 text-amber-900"
              : "bg-red-50 border border-red-200 text-red-900"
          }`}
        >
          <span>
            {msg.type === "success" ? "✓" : msg.type === "warning" ? "⚠️" : "✕"} {msg.text}
          </span>
          <button type="button" onClick={() => setMsg(null)} className="p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 1. Resumen de la Reserva y Barra de Estado ── */}
      <div className="bg-white border border-lilac-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border ${resConfig.badgeColor}`}
              >
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
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.badgeCls}`}
            >
              {statusConfig.label}
            </span>

            {/* Acciones de cambio de estado */}
            {canEdit && currentStatus !== "facturado" && currentStatus !== "cancelado" && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentStatus === "reservado" && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange("en_curso")}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    <PlayCircle size={13} /> Iniciar Atención
                  </button>
                )}

                {currentStatus === "en_curso" && (
                  <button
                    type="button"
                    disabled={changingStatus}
                    onClick={() => handleStatusChange("finalizado")}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition disabled:opacity-50"
                  >
                    <CheckCircle size={13} /> Completar Alquiler
                  </button>
                )}

                <button
                  type="button"
                  disabled={changingStatus}
                  onClick={() => setConfirmCancelOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50"
                >
                  <XCircle size={13} /> Cancelar Alquiler
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Datos clave de horario y tarifa - Adaptados a móvil con fuentes compactas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
          <div className="bg-lilac-50/40 p-2.5 sm:p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[9px] sm:text-[10px] text-ink-400 font-bold uppercase tracking-wider block truncate">
              Horario
            </span>
            <span className="font-mono font-bold text-ink-900 text-xs sm:text-sm mt-0.5 block">
              {rental.start_time.slice(0, 5)} - {rental.end_time.slice(0, 5)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-ink-500">
              {rental.hours}h ({resConfig.shortName})
            </span>
          </div>

          <div className="bg-lilac-50/40 p-2.5 sm:p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[9px] sm:text-[10px] text-ink-400 font-bold uppercase tracking-wider block truncate">
              Total Acordado
            </span>
            <span className="font-mono font-black text-ink-900 text-sm sm:text-base mt-0.5 block">
              ${total.toFixed(2)}
            </span>
            <span className="text-[9px] sm:text-[10px] text-ink-500">Tarifa: ${rental.hourly_rate}/h</span>
          </div>

          <div className="bg-lilac-50/40 p-2.5 sm:p-3 rounded-xl border border-lilac-100/60">
            <span className="text-[9px] sm:text-[10px] text-ink-400 font-bold uppercase tracking-wider block truncate">
              {deposit > 0 ? "Anticipo & Saldo" : "Cobro / Saldo"}
            </span>
            {deposit > 0 ? (
              <div>
                <span className="font-mono font-bold text-emerald-700 text-[11px] sm:text-xs block truncate">
                  ✓ Anticipo: ${deposit.toFixed(2)}
                </span>
                <span className="font-mono font-bold text-amber-800 text-[11px] sm:text-xs block mt-0.5 truncate">
                  Saldo: ${balance.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="font-mono font-bold text-ink-700 text-xs sm:text-sm mt-0.5 block">
                Total: ${total.toFixed(2)}
              </span>
            )}
          </div>

          <div className="bg-lilac-50/40 p-2.5 sm:p-3 rounded-xl border border-lilac-100/60 flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] text-ink-400 font-bold uppercase tracking-wider block truncate">
              Facturación SRI
            </span>
            {rental.invoice_id || currentStatus === "facturado" ? (
              <div>
                <span className="font-mono font-bold text-teal-800 text-[11px] sm:text-xs block truncate">
                  Fac #{rental.invoice_number || "Emitida"}
                </span>
                <Link
                  href={`/erp/facturacion/${rental.invoice_id}`}
                  className="text-[10px] sm:text-[11px] font-bold text-lilac-700 hover:underline"
                >
                  Ver factura SRI →
                </Link>
              </div>
            ) : (
              <div>
                <span className="text-[10px] sm:text-[11px] text-amber-700 font-semibold block truncate">
                  Pendiente facturar
                </span>
                <Link
                  href={invoiceLink}
                  className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-lilac-700 hover:underline mt-0.5"
                >
                  <Receipt size={11} /> Facturar ahora →
                </Link>
              </div>
            )}
          </div>
        </div>

        {deposit > 0 && (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-emerald-900 flex-wrap gap-2">
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

      {/* ── 2. SECCIÓN DE DOCUMENTOS (CONTRATO Y DESCARGO DE RESPONSABILIDAD MULTIDOCUMENTO) ── */}
      <div
        ref={docsSectionRef}
        className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 transition-colors ${
          missingDocsModal ? "border-amber-400 ring-2 ring-amber-300" : "border-lilac-100"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-lilac-100 pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                  Documentación de Respaldo ({contracts.length + waivers.length} archivos)
                </h2>
                {isClinicalSpace && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Requeridos para Sillón y Clínica
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-500">
                Se pueden cargar múltiples páginas, fotos o archivos PDF tanto de contrato como de descargo
              </p>
            </div>
          </div>

          {isClinicalSpace && (
            <div className="text-xs flex items-center gap-2 text-ink-600">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                  contracts.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {contracts.length > 0 ? "✓ Contrato OK" : "✕ Falta Contrato"}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                  waivers.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {waivers.length > 0 ? "✓ Descargo OK" : "✕ Falta Descargo"}
              </span>
            </div>
          )}
        </div>

        {missingDocsModal && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">Documentos obligatorios pendientes</span>
              <p className="text-[11px] leading-relaxed">
                Para <strong>completar el alquiler</strong> de sillones odontológicos o clínica completa, el sistema
                exige haber subido al menos un <strong>Contrato de Arrendamiento</strong> firmado por el doctor y un{" "}
                <strong>Descargo de Responsabilidad</strong> firmado por el paciente. Por favor adjúntalos a
                continuación para poder finalizar la atención.
              </p>
            </div>
          </div>
        )}

        <input
          ref={contractInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, "contract")}
        />
        <input
          ref={waiverInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files, "waiver")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card: Contrato(s) de Alquiler */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-lilac-100 pb-2">
              <div className="flex items-center gap-2.5">
                <FileCheck2 size={20} className={contracts.length > 0 ? "text-teal-600" : "text-ink-400"} />
                <div>
                  <h4 className="text-xs font-bold text-ink-900">Contrato de Arrendamiento</h4>
                  <p className="text-[11px] text-ink-500">Firmado por el doctor arrendatario</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  contracts.length > 0
                    ? "bg-teal-50 text-teal-800 border-teal-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {contracts.length > 0
                  ? `${contracts.length} ${contracts.length === 1 ? "cargado" : "cargados"}`
                  : "Pendiente"}
              </span>
            </div>

            {/* Lista de archivos de contrato */}
            {contracts.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-lilac-100 bg-white border border-lilac-100 rounded-xl overflow-hidden">
                  {contracts.map((doc, idx) => (
                    <li key={doc.id || idx} className="p-2 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-lilac-600 shrink-0" />
                        <span className="font-mono text-ink-800 text-[11px] truncate max-w-[150px] sm:max-w-[200px]" title={doc.name}>
                          {doc.name || `Contrato ${idx + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(proxyStorageUrl(doc.url));
                            setPreviewTitle(`Contrato: ${doc.name}`);
                          }}
                          className="p-1 text-lilac-700 hover:text-lilac-900 rounded-md hover:bg-lilac-50"
                          title="Ver documento"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={proxyStorageUrl(doc.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-lilac-700 hover:text-lilac-900 rounded-md hover:bg-lilac-50"
                          title="Abrir en pestaña nueva"
                        >
                          <ExternalLink size={13} />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc("contract", doc.id, doc.name)}
                            className="p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                            title="Eliminar este archivo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {canEdit && (
                  <button
                    type="button"
                    disabled={uploadingDocType === "contract"}
                    onClick={() => contractInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-lilac-700 hover:text-lilac-900 font-bold py-1.5 border border-dashed border-lilac-200 rounded-lg bg-white hover:bg-lilac-50 transition"
                  >
                    {uploadingDocType === "contract" ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Subiendo...
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Agregar más páginas o archivos
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              canEdit && (
                <button
                  type="button"
                  disabled={uploadingDocType === "contract"}
                  onClick={() => contractInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-lilac-300 hover:border-lilac-400 bg-white hover:bg-lilac-50 text-lilac-800 text-xs font-bold py-3 rounded-xl transition shadow-2xs"
                >
                  {uploadingDocType === "contract" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Subiendo archivo(s)...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} className="text-lilac-600" /> Subir Contrato (PDF o Fotos)
                    </>
                  )}
                </button>
              )
            )}
          </div>

          {/* Card: Descargo(s) de Responsabilidad */}
          <div className="border border-lilac-100 rounded-xl p-4 bg-lilac-50/20 flex flex-col justify-between space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-lilac-100 pb-2">
              <div className="flex items-center gap-2.5">
                <FileText size={20} className={waivers.length > 0 ? "text-teal-600" : "text-ink-400"} />
                <div>
                  <h4 className="text-xs font-bold text-ink-900">Descargo de Responsabilidad</h4>
                  <p className="text-[11px] text-ink-500">Firmado por el paciente atendido</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  waivers.length > 0
                    ? "bg-teal-50 text-teal-800 border-teal-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {waivers.length > 0
                  ? `${waivers.length} ${waivers.length === 1 ? "cargado" : "cargados"}`
                  : "Pendiente"}
              </span>
            </div>

            {/* Lista de archivos de descargo */}
            {waivers.length > 0 ? (
              <div className="space-y-2">
                <ul className="divide-y divide-lilac-100 bg-white border border-lilac-100 rounded-xl overflow-hidden">
                  {waivers.map((doc, idx) => (
                    <li key={doc.id || idx} className="p-2 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={14} className="text-teal-600 shrink-0" />
                        <span className="font-mono text-ink-800 text-[11px] truncate max-w-[150px] sm:max-w-[200px]" title={doc.name}>
                          {doc.name || `Descargo ${idx + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(proxyStorageUrl(doc.url));
                            setPreviewTitle(`Descargo: ${doc.name}`);
                          }}
                          className="p-1 text-lilac-700 hover:text-lilac-900 rounded-md hover:bg-lilac-50"
                          title="Ver documento"
                        >
                          <Eye size={14} />
                        </button>
                        <a
                          href={proxyStorageUrl(doc.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-lilac-700 hover:text-lilac-900 rounded-md hover:bg-lilac-50"
                          title="Abrir en pestaña nueva"
                        >
                          <ExternalLink size={13} />
                        </a>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc("waiver", doc.id, doc.name)}
                            className="p-1 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                            title="Eliminar este archivo"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {canEdit && (
                  <button
                    type="button"
                    disabled={uploadingDocType === "waiver"}
                    onClick={() => waiverInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-lilac-700 hover:text-lilac-900 font-bold py-1.5 border border-dashed border-lilac-200 rounded-lg bg-white hover:bg-lilac-50 transition"
                  >
                    {uploadingDocType === "waiver" ? (
                      <>
                        <Loader2 size={12} className="animate-spin" /> Subiendo...
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Agregar más páginas o archivos
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              canEdit && (
                <button
                  type="button"
                  disabled={uploadingDocType === "waiver"}
                  onClick={() => waiverInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-lilac-300 hover:border-lilac-400 bg-white hover:bg-lilac-50 text-lilac-800 text-xs font-bold py-3 rounded-xl transition shadow-2xs"
                >
                  {uploadingDocType === "waiver" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Subiendo archivo(s)...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={15} className="text-lilac-600" /> Subir Descargo (PDF o Fotos)
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* ── 3. CHECK-IN / FORMULARIO DE DATOS DEL DOCTOR Y PACIENTE ── */}
      <form onSubmit={handleSaveDoctor} className="bg-white border border-lilac-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
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
                Información fiscal y profesional requerida para emitir la factura electrónica y archivar
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
            <label className="text-xs font-semibold text-ink-700">Cédula o RUC (para Facturación SRI) *</label>
            <input
              type="text"
              maxLength={13}
              disabled={!canEdit}
              value={doctorDocument}
              onChange={(e) => setDoctorDocument(e.target.value.replace(/\s+/g, ""))}
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
              placeholder="0991234567"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm font-mono bg-white text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 disabled:bg-gray-50"
            />
          </div>

          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">Correo Electrónico (para Factura SRI)</label>
            <input
              type="email"
              disabled={!canEdit}
              value={doctorEmail}
              onChange={(e) => setDoctorEmail(e.target.value)}
              placeholder="doctor@ejemplo.com"
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
              placeholder="Ortodoncia, Endodoncia, etc."
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
              onChange={(e) => setPatientDocument(e.target.value.replace(/\s+/g, ""))}
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
      <div className="bg-gradient-to-r from-lilac-50/90 via-indigo-50/50 to-teal-50/50 border border-lilac-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Receipt size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-900">
              {currentStatus === "facturado" ? "Alquiler Facturado con SRI" : "Facturación de Alquiler / Coworking"}
            </h3>
            <p className="text-xs text-ink-500">
              {currentStatus === "facturado"
                ? `Factura N° ${rental.invoice_number || "Registrada"} vinculada a esta reserva`
                : "Al completar el alquiler, emite la factura electrónica SRI con los datos del doctor y el servicio precargados por defecto"}
            </p>
          </div>
        </div>

        {currentStatus === "facturado" ? (
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
            className="inline-flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md shadow-lilac-200 transition active:scale-[0.99] shrink-0"
          >
            <Receipt size={16} /> Emitir Factura SRI Ahora
          </Link>
        )}
      </div>

      {/* Modal de Cancelación */}
      {confirmCancelOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setConfirmCancelOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-ink-900">¿Cancelar esta reserva de alquiler?</h3>
                <p className="text-xs text-ink-500">Esta acción cambiará el estado a cancelado.</p>
              </div>
            </div>

            <p className="text-xs text-ink-600 bg-lilac-50/50 p-3 rounded-xl border border-lilac-100">
              La reserva del Dr(a). <strong>{doctorName || rental.doctor_name}</strong> para el espacio{" "}
              <strong>{resConfig.name}</strong> quedará marcada como cancelada y liberará el horario de atención.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-gray-100 rounded-xl transition"
              >
                No cancelar
              </button>
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => handleStatusChange("cancelado")}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {changingStatus ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Cancelando...
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> Confirmar Cancelación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className="text-xs font-bold text-ink-900 truncate max-w-md">{previewTitle}</span>
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
                    className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-semibold shadow-xs"
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
