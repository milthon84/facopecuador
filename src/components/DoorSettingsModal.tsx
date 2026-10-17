"use client";

import { useState } from "react";
import { 
  X, 
  DoorClosed, 
  DoorOpen, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  HelpCircle,
  KeyRound
} from "lucide-react";
import { updateDoorSettingsAction, openDoorAction } from "@/app/(admin)/erp/asistencia/door-actions";
import type { DoorSettingsDef } from "@/lib/ewelink";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: DoorSettingsDef;
  onSaved?: (newSettings: DoorSettingsDef) => void;
}

export default function DoorSettingsModal({
  isOpen,
  onClose,
  initialSettings,
  onSaved,
}: Props) {
  const [formData, setFormData] = useState({
    device_id: initialSettings.device_id || "1002906ff1",
    device_name: initialSettings.device_name || "Puerta Principal",
    connection_mode: initialSettings.connection_mode || "webhook",
    webhook_url: initialSettings.webhook_url || "",
    app_id: initialSettings.app_id || "",
    app_secret: initialSettings.app_secret || "",
    email: initialSettings.email || "",
    password: initialSettings.password || "",
    region: initialSettings.region || "us",
    is_enabled: initialSettings.is_enabled ?? true,
    auto_close_seconds: initialSettings.auto_close_seconds || 3,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await updateDoorSettingsAction(formData);
      if (res.success) {
        setStatusMsg({ type: "success", text: "Configuración guardada exitosamente." });
        if (onSaved) {
          onSaved({ ...initialSettings, ...formData });
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setStatusMsg({ type: "error", text: res.error || "No se pudo guardar la configuración." });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error al guardar." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestOpen() {
    setIsTesting(true);
    setStatusMsg(null);
    try {
      const res = await openDoorAction();
      if (res.success) {
        setStatusMsg({ type: "success", text: res.message || "¡Comando enviado exitosamente a la puerta!" });
      } else {
        setStatusMsg({ type: "error", text: res.error || "Error al intentar abrir la puerta." });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Error al conectar con el dispositivo." });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-ink-900 to-ink-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gold-500/20 text-gold-400 rounded-xl">
              <DoorClosed size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Configuración de Apertura (eWeLink)</h3>
              <p className="text-white/70 text-xs">Dispositivo ID: {formData.device_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}>
              {statusMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">
                Nombre de la Puerta
              </label>
              <input
                type="text"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">
                Device ID (eWeLink)
              </label>
              <input
                type="text"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 font-mono"
                required
              />
            </div>
          </div>

          {/* Método de Conexión */}
          <div>
            <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1.5">
              Método de Conexión
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, connection_mode: "webhook" })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.connection_mode === "webhook"
                    ? "bg-lilac-50 border-lilac-400 text-lilac-900 shadow-2xs"
                    : "border-gray-200 text-ink-600 hover:bg-gray-50"
                }`}
              >
                <span>⚡ URL de Webhook</span>
                <span className="text-[10px] text-emerald-700 font-normal">(Recomendado)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, connection_mode: "api" })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.connection_mode === "api"
                    ? "bg-lilac-50 border-lilac-400 text-lilac-900 shadow-2xs"
                    : "border-gray-200 text-ink-600 hover:bg-gray-50"
                }`}
              >
                <span>🔐 API CoolKit / eWeLink</span>
              </button>
            </div>
          </div>

          {/* Campos Modo Webhook */}
          {formData.connection_mode === "webhook" ? (
            <div className="bg-lilac-50/40 p-4 rounded-xl border border-lilac-100 space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-ink-900 mb-1">
                  URL del Webhook de eWeLink o IFTTT
                </label>
                <input
                  type="url"
                  placeholder="https://eu-apia.coolkit.cc/v2/smartscene2/webhooks/execute?id=... o IFTTT"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                  required={formData.connection_mode === "webhook"}
                />
              </div>

              <div className="text-[11px] text-ink-600 bg-white p-2.5 rounded-lg border border-lilac-100 space-y-1">
                <p className="font-bold text-ink-800 flex items-center gap-1">
                  <HelpCircle size={13} className="text-lilac-600" />
                  ¿Cómo obtener la URL del Webhook?
                </p>
                <p>
                  1. En <strong>web.ewelink.cc</strong>, crea una <em>Escena</em> con acción: encender dispositivo <code>{formData.device_id}</code>.
                </p>
                <p>
                  2. Copia la URL de Webhook de la escena y pégala aquí. ¡Listo!
                </p>
              </div>
            </div>
          ) : (
            /* Campos Modo API CoolKit */
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">Correo eWeLink</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">App ID (dev.ewelink.cc)</label>
                  <input
                    type="text"
                    value={formData.app_id}
                    onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">App Secret</label>
                  <input
                    type="password"
                    value={formData.app_secret}
                    onChange={(e) => setFormData({ ...formData, app_secret: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">Región</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="us">us (América / Ecuador)</option>
                    <option value="eu">eu (Europa)</option>
                    <option value="as">as (Asia)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-700 uppercase mb-1">Auto-apagado (segundos)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.auto_close_seconds}
                    onChange={(e) => setFormData({ ...formData, auto_close_seconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-between border-t border-gray-100">
            <button
              type="button"
              onClick={handleTestOpen}
              disabled={isTesting || isSaving}
              className="px-3.5 py-2 bg-lilac-50 hover:bg-lilac-100 text-lilac-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isTesting ? <Loader2 size={14} className="animate-spin" /> : <DoorOpen size={14} />}
              <span>{isTesting ? "Enviando comando..." : "Probar Apertura"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-ink-600 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-ink-900 hover:bg-ink-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
