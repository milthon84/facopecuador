"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { recordPunchAction } from "@/app/(admin)/erp/asistencia/actions";
import { calculateDistanceMeters } from "@/lib/attendance";
import type { AttendanceOfficeSettings, AttendancePunch } from "@/lib/attendance";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  punchType: "in" | "out";
  officeSettings: AttendanceOfficeSettings;
  onSuccess?: (punch: AttendancePunch) => void;
}

export default function AttendancePunchModal({
  isOpen,
  onClose,
  punchType,
  officeSettings,
  onSuccess,
}: Props) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // GPS State
  const [gpsLoading, setGpsLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isInOffice, setIsInOffice] = useState<boolean>(true);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    isLate?: boolean;
    lateMinutes?: number;
    distance?: number | null;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta captura de video en vivo.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn("No se pudo iniciar la cámara web:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Por favor permite el acceso a la cámara en tu navegador."
          : "No se pudo acceder a la cámara frontal. Puedes usar el botón de subir foto."
      );
      setCameraActive(false);
    }
  }, []);

  const acquireGps = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Tu dispositivo o navegador no soporta geolocalización.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setCoords({ lat: latitude, lng: longitude, accuracy });

        const dist = calculateDistanceMeters(
          latitude,
          longitude,
          Number(officeSettings.latitude),
          Number(officeSettings.longitude)
        );
        setDistanceMeters(dist);
        setIsInOffice(dist <= Number(officeSettings.radius_meters));
        setGpsLoading(false);
      },
      (err) => {
        console.warn("Error obteniendo GPS:", err);
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === 1) msg = "Permiso de ubicación denegado. Activa el GPS para continuar.";
        if (err.code === 2) msg = "Señal de GPS no disponible.";
        if (err.code === 3) msg = "Tiempo de espera agotado al consultar GPS.";
        setGpsError(msg);
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, [officeSettings.latitude, officeSettings.longitude, officeSettings.radius_meters]);

  // 1. Iniciar cámara y GPS al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      setSubmitResult(null);
      setCameraError(null);
      setGpsError(null);
      startCamera();
      acquireGps();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, acquireGps, stopCamera]);

  // Tomar Foto desde Video
  function captureSnapshot() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Efecto espejo para selfie natural
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setCapturedPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      "image/jpeg",
      0.9
    );
  }

  // Tomar Foto mediante selector / fallback móvil
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setCapturedBlob(file);
      setCapturedPreview(URL.createObjectURL(file));
      stopCamera();
    }
  }

  function retakePhoto() {
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  }

  // Enviar Marcación
  async function handleSubmit() {
    if (!capturedBlob && officeSettings.require_photo) {
      alert("Debes tomar una foto selfie para registrar tu asistencia.");
      return;
    }

    if (!coords && officeSettings.require_location) {
      alert("Es necesario obtener tu ubicación GPS antes de timbrar.");
      return;
    }

    if (!isInOffice && !officeSettings.allow_out_of_bounds) {
      alert(
        `Estás fuera del perímetro permitido (${distanceMeters}m de distancia, máximo: ${officeSettings.radius_meters}m). No es posible timbrar fuera de la oficina.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.append("punchType", punchType);

      if (capturedBlob) {
        formData.append("photo", capturedBlob, "selfie.jpg");
      }
      if (coords) {
        formData.append("latitude", coords.lat.toString());
        formData.append("longitude", coords.lng.toString());
        formData.append("accuracy", coords.accuracy.toString());
      }

      const res = await recordPunchAction(formData);

      if (res.success && res.punch) {
        setSubmitResult({
          success: true,
          message:
            punchType === "in"
              ? "¡Entrada registrada con éxito!"
              : "¡Salida registrada con éxito!",
          isLate: res.isLate,
          lateMinutes: res.lateMinutes,
          distance: res.distanceMeters,
        });

        if (onSuccess) {
          onSuccess(res.punch);
        }

        // Auto cerrar tras 2.5 segundos
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        setSubmitResult({
          success: false,
          message: res.error || "No se pudo registrar la asistencia.",
        });
      }
    } catch (err: any) {
      setSubmitResult({
        success: false,
        message: err.message || "Error al procesar la marcación.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const isEntry = punchType === "in";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between text-white ${
          isEntry ? "bg-gradient-to-r from-emerald-600 to-teal-700" : "bg-gradient-to-r from-amber-600 to-rose-600"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isEntry ? "Marcar Entrada" : "Marcar Salida"}
              </h3>
              <p className="text-white/80 text-xs">Selfie en vivo + Validación GPS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 flex flex-col gap-4">
          {submitResult ? (
            /* Vista de resultado */
            <div className="py-8 flex flex-col items-center text-center gap-3">
              {submitResult.success ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={36} />
                  </div>
                  <h4 className="text-xl font-bold text-ink-900">{submitResult.message}</h4>
                  <div className="text-sm text-ink-600 space-y-1">
                    {submitResult.isLate && (
                      <p className="text-amber-700 font-medium">
                        ⚠️ Registro con atraso de {submitResult.lateMinutes} minutos.
                      </p>
                    )}
                    {submitResult.distance !== null && submitResult.distance !== undefined && (
                      <p className="text-xs text-ink-500">
                        Distancia a la oficina: {submitResult.distance} m
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                    <AlertCircle size={36} />
                  </div>
                  <h4 className="text-lg font-bold text-ink-900">No se pudo registrar</h4>
                  <p className="text-sm text-rose-600 font-medium">{submitResult.message}</p>
                  <button
                    onClick={() => setSubmitResult(null)}
                    className="mt-2 px-4 py-2 bg-ink-900 text-white rounded-lg text-xs font-semibold hover:bg-ink-800"
                  >
                    Intentar de nuevo
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Sección Cámara */}
              <div className="relative w-full aspect-4/3 bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
                {capturedPreview ? (
                  // Foto tomada
                  <div className="relative w-full h-full">
                    <img
                      src={capturedPreview}
                      alt="Selfie de asistencia"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={retakePhoto}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition"
                    >
                      <RefreshCw size={14} />
                      Repetir foto
                    </button>
                  </div>
                ) : cameraActive ? (
                  // Video en vivo
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-xl" />
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white text-ink-900 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 hover:bg-gray-100 active:scale-95 transition"
                    >
                      <Camera size={16} className="text-emerald-600" />
                      Capturar Selfie
                    </button>
                  </div>
                ) : (
                  // Estado de error o carga de cámara
                  <div className="p-4 text-center text-white flex flex-col items-center gap-2.5">
                    <Camera size={32} className="text-white/60 animate-pulse" />
                    <p className="text-xs text-white/80 max-w-xs">{cameraError || "Iniciando cámara..."}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={startCamera}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <RefreshCw size={14} /> Reintentar
                      </button>
                      <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg cursor-pointer flex items-center gap-1">
                        <Camera size={14} /> Tomar con cámara
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          onChange={handleFileInputChange}
                        />
                      </label>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Indicador de Ubicación GPS */}
              <div className="bg-lilac-50/50 border border-lilac-100 rounded-xl p-3 flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  gpsLoading
                    ? "bg-gray-200 text-gray-600"
                    : isInOffice
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  <MapPin size={16} />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-800">Ubicación GPS:</span>
                    {coords && (
                      <span className="text-[10px] text-ink-400">
                        ±{Math.round(coords.accuracy)}m
                      </span>
                    )}
                  </div>

                  {gpsLoading ? (
                    <div className="flex items-center gap-1.5 text-ink-500 mt-1">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Detectando ubicación de la oficina...</span>
                    </div>
                  ) : gpsError ? (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-rose-600 font-medium">{gpsError}</span>
                      <button
                        onClick={acquireGps}
                        className="text-xs text-lilac-700 font-bold hover:underline"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1">
                      {isInOffice ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 size={13} />
                          <span>En la oficina ({distanceMeters} m de distancia)</span>
                        </div>
                      ) : (
                        <div className="text-amber-800">
                          <span className="font-semibold">⚠️ Fuera del perímetro: </span>
                          <span>a {distanceMeters} m de la oficina (máx: {officeSettings.radius_meters} m).</span>
                          {!officeSettings.allow_out_of_bounds && (
                            <p className="text-rose-600 text-[11px] font-bold mt-0.5">
                              Debes estar en la oficina para marcar.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de Confirmación Principal */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (!capturedBlob && officeSettings.require_photo) ||
                  (gpsLoading && officeSettings.require_location) ||
                  (!isInOffice && !officeSettings.allow_out_of_bounds)
                }
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isEntry
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Guardando marcación...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Confirmar {isEntry ? "Entrada" : "Salida"}</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
