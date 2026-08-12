"use client";

import { useState } from "react";
import { 
  Send, Mail, MessageSquare, Check, Users, Copy, CheckSquare, Square, ExternalLink, Share2
} from "lucide-react";

interface ClassOption {
  id: string;
  title: string;
  date: string;
}

interface StudentItem {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
}

interface Props {
  courseId: string;
  courseName: string;
  classes: ClassOption[];
  students: StudentItem[];
  canEdit: boolean;
  sendNoticeAction: (formData: FormData) => Promise<void>;
}

function cleanPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "593" + cleaned.slice(1);
  }
  return cleaned;
}


export default function NoticeComposerClient({
  courseId,
  courseName,
  classes,
  students,
  canEdit,
  sendNoticeAction,
}: Props) {
  // TODOS LOS ALUMNOS SELECCIONADOS POR DEFECTO
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    students.map((s) => s.id)
  );

  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [sendWhatsapp, setSendWhatsapp] = useState<boolean>(true);

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Toggle Seleccionar Todos
  const isAllSelected = selectedStudentIds.length === students.length && students.length > 0;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s.id));
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sId) => sId !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  // Plantillas rápidas
  const handleSelectTemplate = (type: string) => {
    if (type === "recordatorio") {
      setSubject("Recordatorio de Próxima Clase");
      setMessage(
        `Estimados doctores,\n\nLes recordamos que nuestra próxima clase del curso "${courseName}" está programada. Por favor asistir puntualmente.\n\nSaludos cordiales,`
      );
    } else if (type === "requisitos") {
      setSubject("Requisitos para la Sesión Clínica");
      setMessage(
        `Estimados doctores,\n\nFavor traer los materiales e instrumental quirúrgico/clínico completo para la siguiente sesión práctica.\n\nSaludos cordiales,`
      );
    } else if (type === "aviso") {
      setSubject("Aviso Importante");
      setMessage(
        `Estimados doctores,\n\nLes informamos sobre una actualización importante en el cronograma del programa.\n\nSaludos cordiales,`
      );
    }
  };

  // Texto formateado oficial para WhatsApp con emojis
  const buildWhatsAppText = () => {
    let text = `📢 *COMUNICADO OFICIAL*\n🎓 *${courseName}*\n`;
    if (selectedClass) {
      text += `🗓️ *Clase:* ${selectedClass.title}\n`;
    }
    if (subject.trim()) {
      text += `📌 *Asunto:* ${subject.trim()}\n`;
    }
    text += `\n${message.trim()}\n\n--\n*FACOP Ecuador - Educación Continua*`;
    return text;
  };

  // Copiar al portapapeles
  const copyToClipboard = () => {
    const text = buildWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Disparar App de WhatsApp (Escritorio / Móvil)
  const triggerWhatsAppApp = () => {
    const text = buildWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);

    const waAppUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
    window.location.href = waAppUrl;
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    if (selectedStudentIds.length === 0) {
      alert("Por favor selecciona al menos un alumno destinatario.");
      return;
    }

    setLoading(true);
    try {
      // 1. SI WHATSAPP ESTÁ ACTIVO, DISPARAR APP NATIVA DE WHATSAPP Y COPIAR MENSAJE
      if (sendWhatsapp) {
        triggerWhatsAppApp();
      }

      // 2. SI EMAIL ESTÁ ACTIVO, EJECUTAR ENVÍO DE CORREOS
      if (sendEmail) {
        const formData = new FormData(e.currentTarget);
        formData.set("channel", sendEmail && sendWhatsapp ? "both" : sendEmail ? "email" : "whatsapp");
        await sendNoticeAction(formData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200/90 shadow-sm rounded-3xl p-6 space-y-5">
      {/* Encabezado Simple */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">Redactar Comunicado</h2>
          <p className="text-xs text-slate-500 font-medium">Selecciona el mensaje, canales y destinatarios</p>
        </div>

        {/* Plantillas Rápidas */}
        <select
          onChange={(e) => handleSelectTemplate(e.target.value)}
          defaultValue=""
          className="text-xs bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-xl cursor-pointer"
        >
          <option value="" disabled>⚡ Cargar Plantilla</option>
          <option value="recordatorio">📌 Recordatorio de Clase</option>
          <option value="requisitos">📋 Requisitos Clínicos</option>
          <option value="aviso">📢 Aviso General</option>
        </select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="courseId" value={courseId} />

        {/* Asunto */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">Asunto del Comunicado *</label>
          <input
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: Requisitos para el Módulo Clínico"
            className="w-full text-xs font-medium text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-lilac-500 focus:outline-none"
          />
        </div>

        {/* Asociar a Clase */}
        {classes.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Asociar a una clase (opcional)</label>
            <select
              name="classId"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs font-medium text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-lilac-500 focus:outline-none"
            >
              <option value="">— Ninguna clase en particular (Aviso General) —</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title} ({new Date(cls.date + "T12:00:00").toLocaleDateString("es-EC")})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mensaje */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">Mensaje *</label>
          <textarea
            name="message"
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe aquí el mensaje oficial..."
            className="w-full text-xs font-medium text-slate-900 bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:border-lilac-500 focus:outline-none resize-none leading-relaxed"
          />
        </div>

        {/* Canales de Envío Simples */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-slate-800 mb-2">Canales de Envío</label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="w-4 h-4 rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer"
              />
              <Mail size={14} className="text-blue-600" />
              <span>Correo Electrónico</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendWhatsapp}
                onChange={(e) => setSendWhatsapp(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <MessageSquare size={14} className="text-emerald-600" />
              <span>App de WhatsApp (Difusión)</span>
            </label>
          </div>
        </div>

        {/* FORMATO Y PREVISUALIZACIÓN DE WHATSAPP MIENTRAS SE REDACTA */}
        {sendWhatsapp && (subject.trim() || message.trim()) && (
          <div className="p-4 bg-emerald-950 border border-emerald-800 rounded-2xl space-y-3 text-emerald-50 shadow-sm">
            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <MessageSquare size={14} /> Formato Oficial de WhatsApp
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-[11px] font-bold text-emerald-200 hover:text-white bg-emerald-900 border border-emerald-700 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                <span>{copied ? "¡Copiado!" : "Copiar Texto WA"}</span>
              </button>
            </div>

            <div className="text-xs font-mono text-emerald-100 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pr-1">
              {buildWhatsAppText()}
            </div>

            {/* BOTON ÚNICO: ABRIR WHATSAPP APP */}
            <button
              type="button"
              onClick={triggerWhatsAppApp}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xs py-2.5 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <MessageSquare size={14} />
              <span>Abrir WhatsApp App con este Mensaje Precargado</span>
            </button>
          </div>
        )}

        {/* SELECCIÓN DE ALUMNOS (TODOS SELECCIONADOS POR DEFECTO) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <label
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer select-none"
            >
              {isAllSelected ? (
                <CheckSquare size={16} className="text-lilac-700" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              <span>Seleccionar Todos los Alumnos</span>
            </label>

            <span className="text-[11px] font-bold text-lilac-700 bg-white border border-lilac-200 px-2.5 py-0.5 rounded-md shadow-2xs">
              {selectedStudentIds.length} de {students.length} seleccionados
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white p-1">
            {students.length === 0 ? (
              <div className="text-center text-xs text-slate-400 italic py-4">No hay alumnos matriculados en este curso.</div>
            ) : (
              students.map((st) => {
                const checked = selectedStudentIds.includes(st.id);
                return (
                  <div
                    key={st.id}
                    onClick={() => toggleStudent(st.id)}
                    className={`p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer transition gap-2 ${
                      checked ? "bg-lilac-50/40" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {checked ? (
                        <CheckSquare size={15} className="text-lilac-700 shrink-0" />
                      ) : (
                        <Square size={15} className="text-slate-300 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900 truncate">{st.full_name}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {st.phone ? (
                        <a
                          href={`whatsapp://send?phone=${cleanPhoneForWhatsApp(st.phone)}&text=${encodeURIComponent(buildWhatsAppText())}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-md shadow-2xs transition hover:scale-[1.02]"
                          title="Abrir chat directamente en la App de WhatsApp"
                        >
                          <MessageSquare size={11} />
                          <span>WhatsApp App</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Sin celular</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Botón Principal de Envío */}
        <button
          type="submit"
          disabled={loading || !canEdit || selectedStudentIds.length === 0}
          className="w-full bg-lilac-700 hover:bg-lilac-800 text-white font-bold text-xs py-3 px-5 rounded-2xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>Enviando comunicado...</span>
          ) : (
            <>
              <Send size={15} />
              <span>
                Enviar Comunicado a ({selectedStudentIds.length}) Alumnos Seleccionados
              </span>
            </>
          )}
        </button>

        {copied && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            ¡Texto formateado copiado al portapapeles y App de WhatsApp iniciada!
          </div>
        )}
      </form>
    </div>
  );
}
