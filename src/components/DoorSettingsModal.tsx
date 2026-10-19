"use client";

import { useState, useEffect } from "react";
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
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Unlink
} from "lucide-react";
import { 
  updateDoorSettingsAction, 
  testDoorSettingsAction,
  disconnectEWeLinkAction 
} from "@/app/(admin)/erp/asistencia/door-actions";
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
    connection_mode: initialSettings.connection_mode || "api",
    webhook_url: initialSettings.webhook_url || "",
    app_id: initialSettings.app_id || "",
    app_secret: initialSettings.app_secret || "",
    email: initialSettings.email || "",
    password: initialSettings.password || "",
    region: initialSettings.region || "us",
    is_enabled: initialSettings.is_enabled ?? true,
    auto_close_seconds: initialSettings.auto_close_seconds || 3,
    is_oauth_configured: initialSettings.is_oauth_configured ?? false,
  });

  const [origin, setOrigin] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (initialSettings) {
      const isOAuthConfigured = 
        initialSettings.is_oauth_configured || 
        initialSettings.password === "[CONECTADO_VIA_OAUTH]";

      setFormData({
        device_id: initialSettings.device_id || "1002906ff1",
        device_name: initialSettings.device_name || "Puerta Principal",
        connection_mode: initialSettings.connection_mode || "api",
        webhook_url: initialSettings.webhook_url || "",
        app_id: initialSettings.app_id || "",
        app_secret: initialSettings.app_secret || "",
        email: initialSettings.email || "",
        password: initialSettings.password || "",
        region: initialSettings.region || "us",
        is_enabled: initialSettings.is_enabled ?? true,
        auto_close_seconds: initialSettings.auto_close_seconds || 3,
        is_oauth_configured: isOAuthConfigured,
      });
    }
  }, [initialSettings, isOpen]);

  useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("ewelink_success") === "true") {
        setStatusMsg({
          type: "success",
          text: `¡Cuenta de eWeLink vinculada con éxito vía OAuth!${searchParams.get("ewelink_email") ? ` (${searchParams.get("ewelink_email")})` : ""}`,
        });
        setFormData((prev) => ({
          ...prev,
          is_oauth_configured: true,
          password: "[CONECTADO_VIA_OAUTH]",
          email: searchParams.get("ewelink_email") || prev.email,
        }));
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      } else if (searchParams.get("ewelink_error")) {
        setStatusMsg({
          type: "error",
          text: decodeURIComponent(searchParams.get("ewelink_error") || "Error en autorización"),
        });
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const callbackUrl = `${origin || "https://facop.com.ec"}/api/ewelink/callback`;

  function handleCopyRedirectUrl() {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  async function handleOAuthConnect() {
    if (!formData.app_id?.trim() || !formData.app_secret?.trim()) {
      setStatusMsg({
        type: "error",
        text: "Primero ingresa tu App ID y App Secret de dev.ewelink.cc",
      });
      return;
    }

    setIsAuthorizing(true);
    setStatusMsg(null);

    try {
      await updateDoorSettingsAction(formData);
      const returnTo = window.location.pathname;
      const authorizeUrl = `/api/ewelink/authorize?app_id=${encodeURIComponent(
        formData.app_id.trim()
      )}&app_secret=${encodeURIComponent(
        formData.app_secret.trim()
      )}&return_to=${encodeURIComponent(returnTo)}`;

      window.location.href = authorizeUrl;
    } catch (err: any) {
      setIsAuthorizing(false);
      setStatusMsg({ type: "error", text: err.message || "Error al iniciar conexión con eWeLink" });
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Deseas desvincular la cuenta actual de eWeLink?")) return;
    try {
      await disconnectEWeLinkAction();
      setFormData((prev) => ({
        ...prev,
        password: "",
        is_oauth_configured: false,
      }));
      setStatusMsg({ type: "success", text: "Cuenta de eWeLink desvinculada." });
    } catch (e: any) {
      setStatusMsg({ type: "error", text: e.message || "Error al desvincular" });
    }
  }

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
      const res = await testDoorSettingsAction(formData);
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
      <div className="relative w-full max-w-lg bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <DoorClosed size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">Configuración de Apertura (eWeLink)</h3>
              <p className="text-white/70 text-xs font-mono">Dispositivo ID: {formData.device_id}</p>
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
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-slate-900">
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
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Nombre de la Puerta
              </label>
              <input
                type="text"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                placeholder="Ej. Puerta Principal"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Device ID (eWeLink)
              </label>
              <input
                type="text"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                placeholder="1002906ff1"
                required
              />
            </div>
          </div>

          {/* Método de Conexión */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
              Método de Conexión
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, connection_mode: "api" })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.connection_mode === "api"
                    ? "bg-purple-50 border-purple-400 text-purple-950 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>🔐 Conexión Oficial eWeLink</span>
                <span className="text-[10px] text-emerald-700 font-bold">(Gratis)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, connection_mode: "webhook" })}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  formData.connection_mode === "webhook"
                    ? "bg-purple-50 border-purple-400 text-purple-950 shadow-xs"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>⚡ URL de Webhook</span>
              </button>
            </div>
          </div>

          {/* Campos Modo API Oficial eWeLink */}
          {formData.connection_mode === "api" ? (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    App ID (dev.ewelink.cc)
                  </label>
                  <input
                    type="text"
                    value={formData.app_id}
                    onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                    placeholder="App ID de CoolKit"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    App Secret
                  </label>
                  <input
                    type="password"
                    value={formData.app_secret}
                    onChange={(e) => setFormData({ ...formData, app_secret: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Guía Redirect URL */}
              <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                    <KeyRound size={13} className="text-purple-600" />
                    Redirect URL requerida en dev.ewelink.cc:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRedirectUrl}
                    className="text-[10px] font-bold text-purple-800 hover:text-purple-950 bg-white px-2 py-0.5 rounded-md border border-purple-300 flex items-center gap-1 transition"
                  >
                    {copiedUrl ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copiedUrl ? "¡Copiado!" : "Copiar"}</span>
                  </button>
                </div>
                <code className="block text-[11px] font-mono text-purple-950 bg-white p-2 rounded-lg border border-purple-200 select-all break-all">
                  {callbackUrl}
                </code>
                <p className="text-[10px] text-purple-700 leading-tight">
                  En tu app de <strong>dev.ewelink.cc</strong>, pega esta URL en el campo <em>Redirect URL</em>.
                </p>
              </div>

              {/* Estado de Vinculación OAuth */}
              {formData.is_oauth_configured ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-950">Cuenta vinculada oficialmente</p>
                      <p className="text-[11px] text-emerald-800 font-mono">
                        {formData.email ? formData.email : "Autorizado vía OAuth 2.0 (Token activo)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      title="Desvincular cuenta"
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition"
                    >
                      <Unlink size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={handleOAuthConnect}
                      disabled={isAuthorizing}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition"
                    >
                      {isAuthorizing ? <Loader2 size={12} className="animate-spin" /> : "Reconectar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div>
                    <p className="text-xs font-bold text-amber-950">Vinculación en 1 clic (100% Gratis)</p>
                    <p className="text-[11px] text-amber-800 leading-tight">
                      No necesitas escribir tu contraseña aquí. Haz clic en el botón para autorizar tu cuenta en la web oficial de eWeLink:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOAuthConnect}
                    disabled={isAuthorizing || !formData.app_id?.trim() || !formData.app_secret?.trim()}
                    className="w-full py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    {isAuthorizing ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    <span>Conectar Cuenta con eWeLink (Gratis)</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Región</label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                  >
                    <option value="us">us (América / Ecuador)</option>
                    <option value="eu">eu (Europa)</option>
                    <option value="as">as (Asia)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Auto-apagado (segundos)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.auto_close_seconds}
                    onChange={(e) => setFormData({ ...formData, auto_close_seconds: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Campos Modo Webhook */
            <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100 space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  URL del Webhook de eWeLink o IFTTT
                </label>
                <input
                  type="url"
                  placeholder="https://maker.ifttt.com/trigger/abrir_puerta/with/key/..."
                  value={formData.webhook_url}
                  onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
                  required={formData.connection_mode === "webhook"}
                />
              </div>

              <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-purple-100 space-y-1">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <HelpCircle size={13} className="text-purple-600" />
                  ¿Cómo usar Webhook?
                </p>
                <p>
                  Si cuentas con un servicio de Webhook externo (ej. IFTTT o servidor local), pega la URL directa para activar el dispositivo <code>{formData.device_id}</code>.
                </p>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestOpen}
              disabled={isTesting || isSaving}
              className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isTesting ? <Loader2 size={14} className="animate-spin" /> : <DoorOpen size={14} />}
              <span>{isTesting ? "Enviando comando..." : "Probar Apertura"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
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
