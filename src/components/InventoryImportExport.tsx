"use client";

import { useRef, useState } from "react";
import { Upload, Download, X, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "success" | "error";

export default function InventoryImportExport({ canImport = true }: { canImport?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  // ── EXPORTAR ──────────────────────────────────────────────────────────────
  function handleExport() {
    window.location.href = "/api/admin/inventario/export";
  }

  // ── IMPORTAR ──────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    setStatus("loading");
    setMessage("");
    setWarnings([]);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/inventario/import", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Error al importar el archivo.");
        if (data.details) setWarnings(data.details);
        return;
      }

      setStatus("success");
      setMessage(data.message || "Importación completada.");
      if (data.warnings) setWarnings(data.warnings);

      router.refresh();
    } catch {
      setStatus("error");
      setMessage("No se pudo conectar con el servidor.");
    }
  }

  function dismiss() {
    setStatus("idle");
    setMessage("");
    setWarnings([]);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Botones compactos integrados en cabecera */}
      <div className="flex items-center gap-2">
        {/* Exportar */}
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
          title="Descargar plantilla / reporte Excel de inventario"
        >
          <Download size={15} className="text-lilac-600 shrink-0" />
          <span className="hidden sm:inline">Descargar Excel</span>
          <span className="sm:hidden">Exportar</span>
        </button>

        {/* Importar */}
        {canImport && (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === "loading"}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-white border border-lilac-200 hover:bg-lilac-50 text-ink-700 px-3 py-1.5 rounded-xl transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
              title="Cargar catálogo de productos desde Excel"
            >
              {status === "loading" ? (
                <Loader2 size={15} className="animate-spin text-lilac-500 shrink-0" />
              ) : (
                <Upload size={15} className="text-lilac-600 shrink-0" />
              )}
              <span className="hidden sm:inline">{status === "loading" ? "Importando…" : "Cargar Excel"}</span>
              <span className="sm:hidden">{status === "loading" ? "..." : "Importar"}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Feedback de Importación */}
      {status !== "idle" && status !== "loading" && (
        <div
          className={`flex gap-3 items-start rounded-xl px-3 py-2 text-xs border fixed bottom-5 right-5 z-50 shadow-xl max-w-sm ${
            status === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {status === "success" ? (
            <CheckCircle size={16} className="shrink-0 mt-0.5 text-green-600" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
          )}
          <div className="flex-1">
            <p className="font-semibold">{message}</p>
            {warnings.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11px] opacity-80 list-disc list-inside">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
          <button onClick={dismiss} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
