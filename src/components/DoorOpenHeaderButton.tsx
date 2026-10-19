"use client";

import { useState, useEffect } from "react";
import { 
  DoorClosed, 
  DoorOpen, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  WifiOff,
  X,
  Settings,
  KeyRound
} from "lucide-react";
import { getDoorSettingsAction, openDoorAction } from "@/app/(admin)/erp/asistencia/door-actions";
import DoorSettingsModal from "./DoorSettingsModal";
import type { DoorSettingsDef } from "@/lib/ewelink";

const DEFAULT_DOOR_SETTINGS: DoorSettingsDef = {
  id: "default",
  device_id: "1002906ff1",
  device_name: "Puerta Principal",
  connection_mode: "webhook",
  webhook_url: "",
  app_id: "",
  app_secret: "",
  email: "",
  password: "",
  region: "us",
  is_enabled: true,
  auto_close_seconds: 3,
};

interface Props {
  canEdit?: boolean;
}

export default function DoorOpenHeaderButton({ canEdit: canEditProp }: Props = {}) {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openedSuccess, setOpenedSuccess] = useState(false);
  const [settings, setSettings] = useState<DoorSettingsDef>(DEFAULT_DOOR_SETTINGS);
  const [canEdit, setCanEdit] = useState(canEditProp ?? false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
    needConfig?: boolean;
  } | null>(null);

  useEffect(() => {
    if (canEditProp !== undefined) {
      setCanEdit(canEditProp);
    }
  }, [canEditProp]);

  useEffect(() => {
    loadSettings();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("ewelink_success") || sp.has("ewelink_error")) {
        setSettingsModalOpen(true);
      }
    }
  }, []);

  async function loadSettings() {
    try {
      const res = await getDoorSettingsAction();
      if (res.success && res.settings) {
        setSettings(res.settings);
        if (canEditProp === undefined && res.canEdit !== undefined) {
          setCanEdit(!!res.canEdit);
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar configuración de la puerta:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDoor() {
    if (opening || openedSuccess) return;

    // Si aún no está configurado el webhook ni credenciales
    const isConfigured =
      settings &&
      ((settings.connection_mode === "webhook" && !!settings.webhook_url?.trim()) ||
        (settings.connection_mode === "api" && (settings.is_oauth_configured || !!settings.password?.trim())));

    if (!isConfigured) {
      if (canEdit) {
        setSettingsModalOpen(true);
      } else {
        setFeedback({
          isOpen: true,
          type: "warning",
          title: "Apertura no configurada",
          message: "La apertura de puerta aún no ha sido configurada por el administrador.",
        });
      }
      return;
    }

    setOpening(true);

    try {
      const res = await openDoorAction();
      if (res.success) {
        setOpenedSuccess(true);
        // Mantener feedback verde durante 3.5 segundos
        setTimeout(() => {
          setOpenedSuccess(false);
        }, 3500);
      } else if (res.needConfig && canEdit) {
        setSettingsModalOpen(true);
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "No se pudo abrir la puerta",
          message: res.error || "El dispositivo de la puerta no respondió.",
          needConfig: res.needConfig,
        });
      }
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error al comunicar con la puerta",
        message: err.message || "Ocurrió un error inesperado al enviar el comando.",
      });
    } finally {
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <div className="h-8 px-2.5 rounded-lg bg-white/10 flex items-center gap-1.5 text-xs text-white/50 animate-pulse">
        <KeyRound size={13} />
        <span className="hidden sm:inline">Puerta...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleOpenDoor}
          disabled={opening}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-75 ${
            openedSuccess
              ? "bg-emerald-500 text-white border border-emerald-400 animate-pulse"
              : opening
              ? "bg-gold-500/90 text-white border border-gold-400"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-gold-400/60"
          }`}
          title={
            settings
              ? `Abrir ${settings.device_name} (${settings.device_id})`
              : "Abrir Puerta"
          }
        >
          {opening ? (
            <>
              <Loader2 size={14} className="animate-spin text-gold-200" />
              <span>Abriendo...</span>
            </>
          ) : openedSuccess ? (
            <>
              <DoorOpen size={14} className="text-white" />
              <span>¡Puerta Abierta!</span>
            </>
          ) : (
            <>
              <KeyRound size={14} className="text-gold-400" />
              <span className="hidden sm:inline">Abrir Puerta</span>
              <span className="sm:hidden">Abrir</span>
            </>
          )}
        </button>

        {canEdit && (
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
            title="Configurar eWeLink / Webhook de la puerta"
          >
            <Settings size={13} />
          </button>
        )}
      </div>

      {/* Modal Popup Controlado para Errores/Avisos de Apertura */}
      {feedback && feedback.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                  feedback.type === "error"
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : feedback.type === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-600"
                    : "bg-emerald-50 border-emerald-200 text-emerald-600"
                }`}
              >
                {feedback.type === "error" ? (
                  <WifiOff size={22} />
                ) : feedback.type === "warning" ? (
                  <AlertCircle size={22} />
                ) : (
                  <CheckCircle2 size={22} />
                )}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {feedback.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {feedback.message}
                </p>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              {canEdit && (
                <button
                  onClick={() => {
                    setFeedback(null);
                    setSettingsModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition"
                >
                  Abrir Configuración
                </button>
              )}
              <button
                onClick={() => setFeedback(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsModalOpen && (
        <DoorSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          initialSettings={settings}
          onSaved={(newSettings) => {
            setSettings(newSettings);
          }}
        />
      )}
    </>
  );
}
