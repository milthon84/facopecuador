"use client";

import { useState, useEffect } from "react";
import { 
  DoorClosed, 
  DoorOpen, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
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

export default function DoorOpenHeaderButton() {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openedSuccess, setOpenedSuccess] = useState(false);
  const [settings, setSettings] = useState<DoorSettingsDef>(DEFAULT_DOOR_SETTINGS);
  const [canEdit, setCanEdit] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await getDoorSettingsAction();
      if (res.success && res.settings) {
        setSettings(res.settings);
        setCanEdit(!!res.canEdit);
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
        (settings.connection_mode === "api" && !!settings.email?.trim() && !!settings.password?.trim()));

    if (!isConfigured) {
      if (canEdit) {
        setSettingsModalOpen(true);
      } else {
        alert("La apertura de puerta aún no ha sido configurada por el administrador.");
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
        alert(res.error || "No se pudo abrir la puerta.");
      }
    } catch (err: any) {
      alert("Error al enviar comando: " + err.message);
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
