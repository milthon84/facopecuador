import { BookOpen } from "lucide-react";

export default function LibroMayorLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white/95 border border-purple-100 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-purple-600">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-ink-900 mb-2">
          Cargando Libro Mayor...
        </h3>
        <p className="text-xs text-ink-500 leading-relaxed mb-4">
          Calculando saldos iniciales, movimientos contables y saldos acumulados por cuenta. Por favor, espere un momento.
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-700">
          <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping"></span>
          Procesamiento contable NIIF
        </div>
      </div>
    </div>
  );
}
