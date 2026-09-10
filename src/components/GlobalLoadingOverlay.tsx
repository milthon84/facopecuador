"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function GlobalLoadingOverlayContent() {
  const [activeRequests, setActiveRequests] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStr = searchParams?.toString() ?? "";
  const lastUrlRef = useRef("");

  // Al cambiar la URL o los parámetros (ej: al volver a la pantalla inicial), desbloquear la pantalla
  useEffect(() => {
    const currentUrl = `${pathname}?${searchStr}`;
    if (lastUrlRef.current && lastUrlRef.current !== currentUrl) {
      setActiveRequests(0);
    }
    lastUrlRef.current = currentUrl;
  }, [pathname, searchStr]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const options = args[1];
      const method = options?.method?.toUpperCase() || "GET";
      const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

      if (isWrite) {
        setActiveRequests((prev) => prev + 1);
      }

      let isRedirecting = false;

      try {
        const response = await originalFetch.apply(window, args);

        // Detectar si la acción del servidor tiene redirección a otra pantalla
        const hasRedirectHeader = Boolean(
          response?.headers?.get("x-action-redirect") ||
          response?.headers?.get("x-nextjs-redirect") ||
          response?.headers?.get("location") ||
          response?.redirected
        );

        if (isWrite && hasRedirectHeader) {
          isRedirecting = true;
          // Se mantendrá bloqueado hasta que el effect de [pathname, searchParams] lo desbloquee.
          // Fallback de seguridad por si no cambia la URL:
          setTimeout(() => {
            setActiveRequests((prev) => Math.max(0, prev - 1));
          }, 3500);
        }

        return response;
      } finally {
        if (isWrite && !isRedirecting) {
          // Dar un breve margen de 400ms para permitir que la vista re-renderice
          setTimeout(() => {
            setActiveRequests((prev) => Math.max(0, prev - 1));
          }, 400);
        }
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (activeRequests === 0) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
      <div className="bg-white border border-lilac-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        <div className="relative mb-5">
          <div className="h-16 w-16 rounded-full border-4 border-lilac-100 border-t-lilac-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-lilac-600">
            <Loader2 size={26} className="animate-spin" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-ink-900 mb-1.5">
          Procesando y Actualizando
        </h3>
        <p className="text-xs text-ink-600 leading-relaxed">
          Guardando cambios y actualizando la vista del sistema. Por favor espera...
        </p>
      </div>
    </div>
  );
}

export default function GlobalLoadingOverlay() {
  return (
    <Suspense fallback={null}>
      <GlobalLoadingOverlayContent />
    </Suspense>
  );
}
