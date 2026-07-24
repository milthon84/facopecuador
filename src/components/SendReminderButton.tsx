"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2, CheckCircle2, AlertCircle, MessageCircle } from "lucide-react";

interface Props {
  appointmentId: string;
  reminderSentAt: string | null;
  patientEmail: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  startsAt?: string | null;
  reason?: string | null;
}

/** Normaliza un teléfono ecuatoriano al formato 593XXXXXXXXX */
function buildEcPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Eliminar espacios, guiones, paréntesis
  const digits = raw.replace(/[\s\-().+]/g, "");
  // Si ya comienza con 593
  if (digits.startsWith("593")) return digits;
  // Si comienza con 0 (formato local Ecuador: 09XXXXXXXX → 5939XXXXXXXX)
  if (digits.startsWith("0")) return "593" + digits.slice(1);
  // Si empieza directo con 9 (sin prefijo)
  if (digits.startsWith("9")) return "593" + digits;
  return digits;
}

/** Construye el mensaje de WhatsApp reemplazando los datos de la cita */
function buildWhatsAppUrl(
  phone: string,
  name: string,
  startsAt: string,
  reason: string
): string {
  const date = new Date(startsAt);

  const fechaFormateada = date.toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const horaFormateada = date.toLocaleTimeString("es-EC", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // String.fromCodePoint garantiza el caracter emoji correcto en runtime
  const HAND  = String.fromCodePoint(0x1F44B);          // 👋
  const CHECK = String.fromCodePoint(0x2705);            // ✅
  const CAL   = String.fromCodePoint(0x1F4C5);           // 📅
  const PIN   = String.fromCodePoint(0x1F4CD);           // 📍
  const MAP   = String.fromCodePoint(0x1F5FA, 0xFE0F);  // 🗺️
  const TOOTH = String.fromCodePoint(0x1F9B7);           // 🦷
  const CLOCK = String.fromCodePoint(0x23F0);            // ⏰

  const mensaje =
    `Hola *${name}* ${HAND}\n\n` +
    `Le recordamos su cita en *Facop Quito Clinica* ${CHECK}\n\n` +
    `${CAL} *Fecha y hora:*\n${fechaFormateada}, ${horaFormateada}\n\n` +
    `${PIN} *Ubicacion:*\nJuan Leon Mera y La Pinta, Edificio Opladen, 3er piso - Quito\n` +
    `${MAP} Ver en Google Maps: https://maps.app.goo.gl/rG2VKyLm5N4yr7s67\n\n` +
    `${TOOTH} *Motivo:* ${reason || "consulta odontológica"}\n\n` +
    `${CLOCK} Si necesita cancelar o reprogramar, contactenos al menos 24 horas antes.`;

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensaje)}`;
}


export default function SendReminderButton({
  appointmentId,
  reminderSentAt,
  patientEmail,
  patientName,
  patientPhone,
  startsAt,
  reason,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    type: "success" | "error" | "whatsapp";
    title: string;
    message: string;
    whatsappUrl?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ecPhone = buildEcPhone(patientPhone);
  const hasWhatsApp = !!ecPhone;

  async function handleSend(e: React.MouseEvent) {
    // Prevent the parent card/row Link navigation
    e.preventDefault();
    e.stopPropagation();

    if (!patientEmail) {
      setAlertModal({
        show: true,
        type: "error",
        title: "Correo no configurado",
        message: "El paciente no tiene un correo electrónico registrado en su ficha.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar recordatorio");

      // Construir URL de WhatsApp si tenemos los datos necesarios
      let whatsappUrl: string | undefined;
      if (hasWhatsApp && patientName && startsAt) {
        whatsappUrl = buildWhatsAppUrl(
          ecPhone!,
          patientName,
          startsAt,
          reason || "consulta odontológica"
        );
      }

      setAlertModal({
        show: true,
        type: whatsappUrl ? "whatsapp" : "success",
        title: "¡Recordatorio Enviado!",
        message: whatsappUrl
          ? "El correo electrónico fue enviado correctamente. ¿Desea también enviar el recordatorio por WhatsApp?"
          : "El correo electrónico de recordatorio ha sido enviado correctamente al paciente.",
        whatsappUrl,
      });
      router.refresh();
    } catch (err: any) {
      setAlertModal({
        show: true,
        type: "error",
        title: "Error al enviar",
        message: err.message || "No se pudo enviar el correo de recordatorio.",
      });
    } finally {
      setLoading(false);
    }
  }

  const hasSent = !!reminderSentAt;

  return (
    <>
      <button
        onClick={handleSend}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
          hasSent
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-gold-300 bg-gold-50 text-gold-700 hover:bg-gold-100 shadow-sm"
        } disabled:opacity-60`}
        title={
          hasSent
            ? `Recordatorio enviado el ${new Date(reminderSentAt).toLocaleString(
                "es-EC"
              )}`
            : "Enviar recordatorio por correo y WhatsApp"
        }
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : hasSent ? (
          <Check size={13} />
        ) : (
          <Bell size={13} />
        )}
        <span>{hasSent ? "Reenviar Recordatorio" : "Enviar Recordatorio"}</span>
      </button>

      {mounted && alertModal?.show && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAlertModal(null);
          }}
        >
          <div
            className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Icono */}
            <div className="flex items-center justify-center mb-4">
              {alertModal.type === "success" && (
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
              )}
              {alertModal.type === "whatsapp" && (
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
              )}
              {alertModal.type === "error" && (
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <AlertCircle size={24} />
                </div>
              )}
            </div>

            {/* Titulo y Mensaje */}
            <h3 className="text-lg font-bold text-ink-900 mb-2">{alertModal.title}</h3>
            <p className="text-xs text-ink-600 leading-relaxed mb-6">{alertModal.message}</p>

            {/* Acciones */}
            <div className="w-full flex flex-col gap-2">
              {alertModal.type === "whatsapp" && alertModal.whatsappUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Abrir WhatsApp con el enlace directo
                    window.location.href = alertModal.whatsappUrl!;
                    setAlertModal(null);
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#25D366] hover:bg-[#1ebe5d] shadow-md transition flex items-center justify-center gap-2"
                >
                  <MessageCircle size={14} />
                  Enviar por WhatsApp
                </button>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlertModal(null);
                }}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition shadow-md ${
                  alertModal.type === "error"
                    ? "text-white bg-red-600 hover:bg-red-700 shadow-red-200"
                    : alertModal.type === "whatsapp"
                    ? "text-ink-700 bg-ink-100 hover:bg-ink-200 shadow-ink-100"
                    : "text-white bg-green-600 hover:bg-green-700 shadow-green-200"
                }`}
              >
                {alertModal.type === "whatsapp" ? "Solo correo, cerrar" : "Aceptar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
