"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, AlertCircle, Stethoscope, GraduationCap, Building2 } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { addCashExpenseAction } from "@/app/(admin)/erp/caja-chica/actions";
import { ExpenseArea } from "@/lib/expense-areas";

interface Props {
  cajaId: string;
}

export default function GastoCajaChicaModal({ cajaId }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [area, setArea] = useState<ExpenseArea>("clinica");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");

  function handleOpen() {
    setAmount("");
    setDate(today);
    setArea("clinica");
    setDescription("");
    setReference("");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(amount);
    if (num <= 0 || !description.trim()) {
      setErrorMsg("Completa la descripción y un monto mayor a cero.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await addCashExpenseAction({
        account_id: cajaId,
        amount: num,
        date,
        area,
        description: description.trim(),
        reference: reference.trim() || null,
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el gasto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-red-200 text-red-700 hover:bg-red-50 transition-colors shadow-xs cursor-pointer"
      >
        <TrendingDown size={15} />
        <span>Gasto Efectivo</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Registrar gasto en efectivo"
        subtitle="Egreso inmediato de la Caja Chica"
        icon={<TrendingDown size={20} className="text-red-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Monto *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-xs font-semibold">
                  $
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                  placeholder="0.00"
                  className="w-full border border-red-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={loading}
                className="w-full border border-red-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-700">
              Destino del Gasto *
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setArea("clinica")}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
                  area === "clinica"
                    ? "border-teal-500 bg-teal-50 text-teal-900 ring-2 ring-teal-200"
                    : "border-slate-200 bg-white text-ink-700 hover:bg-slate-50"
                }`}
              >
                <Stethoscope size={13} className={area === "clinica" ? "text-teal-600" : "text-ink-400"} />
                <span>Clínica</span>
              </button>

              <button
                type="button"
                onClick={() => setArea("cursos")}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
                  area === "cursos"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200"
                    : "border-slate-200 bg-white text-ink-700 hover:bg-slate-50"
                }`}
              >
                <GraduationCap size={13} className={area === "cursos" ? "text-indigo-600" : "text-ink-400"} />
                <span>Cursos</span>
              </button>

              <button
                type="button"
                onClick={() => setArea("general")}
                className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
                  area === "general"
                    ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
                    : "border-slate-200 bg-white text-ink-700 hover:bg-slate-50"
                }`}
              >
                <Building2 size={13} className={area === "general" ? "text-amber-600" : "text-ink-400"} />
                <span>General</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Descripción *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              disabled={loading}
              placeholder="Ej. Taxi, café, insumos menores..."
              className="w-full border border-red-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Recibo / Referencia
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={loading}
              placeholder="N° factura física, recibo..."
              className="w-full border border-red-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <TrendingDown size={14} />
              <span>Guardar Gasto</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
