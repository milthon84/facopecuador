"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Camera, 
  CameraOff,
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Loader2, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  ShieldAlert,
  Clock, 
  Lock,
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

  // Diagnóstico de Permisos y Contexto Seguro
  const [isSecure, setIsSecure] = useState(true);
  const [cameraPermDenied, setCameraPermDenied] = useState(false);
  const [gpsPermDenied, setGpsPermDenied] = useState(false);

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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error(
          "El navegador bloquea la cámara por conexión no segura. Se requiere HTTPS o http://localhost para timbrar."
        );
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador o conexión actual no soporta captura de video en vivo.");
      }

      let stream: MediaStream | null = null;
      try {
        // Intento 1: Cámara frontal / user
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
      } catch (firstErr) {
        // Intento 2: Fallback general sin facingMode (esencial para webcams USB y PCs de escritorio en Windows)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Video play error:", playErr);
        }
      }
      setCameraActive(true);
      setCameraPermDenied(false);
    } catch (err: any) {
      console.warn("No se pudo iniciar la cámara web:", err);
      let msg = "No se pudo acceder a la cámara.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraPermDenied(true);
        msg = "Permiso de cámara bloqueado en el navegador. Haz clic en el icono 🔒 junto a la URL en Chrome y activa 'Cámara'.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No se detectó ninguna cámara web conectada a este equipo.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "La cámara está en uso por otro programa (ej. Teams, Zoom, WhatsApp o Meet). Ciérralo y vuelve a intentar.";
      } else if (err.message) {
        msg = err.message;
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, []);

  // Asegura que en cuanto el elemento <video> esté activo en pantalla, el stream se conecte y reproduzca
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((err) => {
        console.warn("Error reproduciendo video:", err);
      });
    }
  }, [cameraActive]);

  const acquireGps = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGpsError("Se requiere HTTPS o localhost para consultar geolocalización.");
      setGpsLoading(false);
      return;
    }

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
        setGpsPermDenied(false);
      },
      (err) => {
        console.warn("Error obteniendo GPS:", err);
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === 1) {
          setGpsPermDenied(true);
          msg = "Permiso de ubicación bloqueado. Haz clic en el candado 🔒 junto a la URL y activa 'Ubicación'.";
        } else if (err.code === 2) {
          msg = "Señal de GPS no disponible.";
        } else if (err.code === 3) {
          msg = "Tiempo de espera agotado al consultar GPS.";
        }
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

  const checkPermissions = useCallback(async () => {
    if (typeof window !== "undefined") {
      setIsSecure(window.isSecureContext);
    }
    if (typeof navigator !== "undefined" && Boolean((navigator as any).permissions?.query)) {
      try {
        const cam = await (navigator.permissions as any).query({ name: "camera" });
        if (cam.state === "denied") setCameraPermDenied(true);
        else if (cam.state === "granted") setCameraPermDenied(false);
        cam.onchange = () => {
          if (cam.state === "denied") setCameraPermDenied(true);
          else if (cam.state === "granted") {
            setCameraPermDenied(false);
            startCamera();
          }
        };
      } catch (e) {
        // Query camera no soportado en algunos navegadores
      }
      try {
        const geo = await (navigator.permissions as any).query({ name: "geolocation" });
        if (geo.state === "denied") setGpsPermDenied(true);
        else if (geo.state === "granted") setGpsPermDenied(false);
        geo.onchange = () => {
          if (geo.state === "denied") setGpsPermDenied(true);
          else if (geo.state === "granted") {
            setGpsPermDenied(false);
            acquireGps();
          }
        };
      } catch (e) {
        // Query geolocation no soportado
      }
    }
  }, [startCamera, acquireGps]);

  const handleRequestAllPermissions = async () => {
    setCameraError(null);
    setGpsError(null);
    await startCamera();
    acquireGps();
  };

  // 1. Iniciar cámara y GPS al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      setSubmitResult(null);
      setCameraError(null);
      setGpsError(null);
      checkPermissions();
      startCamera();
      acquireGps();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, checkPermissions, startCamera, acquireGps, stopCamera]);

  // Tomar Foto desde Video y devolver Promise<Blob | null>
  function captureSnapshotBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!videoRef.current || !canvasRef.current) {
        resolve(null);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      // Efecto espejo para selfie natural
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCapturedBlob(blob);
            setCapturedPreview(URL.createObjectURL(blob));
            stopCamera();
          }
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  }

  function captureSnapshot() {
    captureSnapshotBlob();
  }

  function retakePhoto() {
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  }

  // Enviar Marcación
  async function handleSubmit() {
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
      let finalBlob = capturedBlob;

      // Si no hay foto previa pero se requiere, capturarla automáticamente de la cámara en vivo
      if (!finalBlob && officeSettings.require_photo) {
        if (cameraActive) {
          finalBlob = await captureSnapshotBlob();
        }
        if (!finalBlob) {
          throw new Error("No se pudo capturar la selfie de la cámara. Verifica que la cámara esté activa.");
        }
      }

      const formData = new FormData();
      formData.append("punchType", punchType);

      if (finalBlob) {
        formData.append("photo", finalBlob, "selfie.jpg");
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
      <div className="relative w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
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
              {/* Alerta si el navegador no está en HTTPS o localhost */}
              {!isSecure && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-rose-950">Conexión Insegura (HTTP detectado)</p>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      Google Chrome y otros navegadores <strong>bloquean por seguridad</strong> el acceso a la cámara y al GPS en conexiones HTTP sin certificado SSL.
                    </p>
                    <p className="text-[11px] text-rose-900 font-semibold">
                      Para que el navegador solicite los permisos y funcione la cámara, accede mediante <strong>https://</strong> o desde <strong>http://localhost:3000</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Guía visual si los permisos están bloqueados en Chrome/Edge */}
              {(cameraPermDenied || gpsPermDenied) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <ShieldAlert size={17} className="text-amber-600 shrink-0" />
                    <span>Permisos bloqueados en el explorador</span>
                  </div>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    Tu navegador tiene bloqueado el acceso a la {cameraPermDenied && gpsPermDenied ? "cámara y ubicación" : cameraPermDenied ? "cámara" : "ubicación"}. Chrome no volverá a mostrar la ventana emergente hasta desbloquearlo:
                  </p>
                  <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/80 space-y-1 text-[11px] font-medium text-amber-900">
                    <div className="flex items-start gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-[10px]">1</span>
                      <span>Haz clic en el icono del candado o controles <span className="font-bold">🔒 o 🎛️</span> junto a la URL arriba.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-[10px]">2</span>
                      <span>Cambia <span className="font-bold">Cámara</span> y <span className="font-bold">Ubicación</span> a <span className="text-emerald-700 font-bold">Permitir</span>.</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center shrink-0 text-[10px]">3</span>
                      <span>Presiona el botón <span className="font-bold underline">Reintentar Activar Permisos</span> a continuación.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestAllPermissions}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs"
                  >
                    <RefreshCw size={13} />
                    <span>Reintentar Activar Permisos</span>
                  </button>
                </div>
              )}

              {/* Sección Cámara */}
              <div className="relative w-full aspect-4/3 bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
                {/* Video en vivo (siempre en el DOM para enlazar inmediatamente el stream del sensor) */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover -scale-x-100 ${
                    cameraActive && !capturedPreview ? "block" : "hidden"
                  }`}
                  onLoadedMetadata={() => {
                    videoRef.current?.play().catch((e) => console.warn("Video play error:", e));
                  }}
                />

                {capturedPreview ? (
                  // Foto tomada
                  <div className="relative w-full h-full">
                    <img
                      src={capturedPreview}
                      alt="Selfie de asistencia"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 backdrop-blur-xs transition z-10"
                    >
                      <RefreshCw size={14} />
                      Repetir foto
                    </button>
                  </div>
                ) : cameraActive ? (
                  // Botón opcional de previsualización sobre el video en vivo
                  <>
                    <div className="absolute inset-0 border-2 border-white/20 pointer-events-none rounded-xl" />
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full font-medium text-xs backdrop-blur-xs flex items-center gap-1.5 transition z-10 shadow-sm"
                    >
                      <Camera size={14} className="text-emerald-400" />
                      <span>Previsualizar foto (opcional)</span>
                    </button>
                  </>
                ) : (
                  // Estado de error o carga de cámara
                  <div className="p-5 text-center text-white flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center">
                      <CameraOff size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Cámara Requerida</h4>
                      <p className="text-xs text-white/80 max-w-xs leading-relaxed">
                        {cameraError || "Iniciando cámara en vivo..."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestAllPermissions}
                      className="px-4 py-2.5 bg-white text-ink-900 hover:bg-gray-100 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition active:scale-95"
                    >
                      <Camera size={15} className="text-emerald-600" />
                      <span>Activar Cámara y Ubicación</span>
                    </button>
                    <p className="text-[10px] text-white/50 max-w-xs">
                      Por seguridad, la selfie debe capturarse en vivo directamente desde la cámara. No se permiten archivos de la computadora ni fotos de la galería.
                    </p>
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
                  (officeSettings.require_photo && !cameraActive && !capturedBlob) ||
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
                    <span>Tomando selfie y registrando...</span>
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
