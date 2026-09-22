"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Save, AlertCircle } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { addBankTransactionAction } from "@/app/(admin)/erp/bancos/actions";

interface Props {
  accountId: string;
  defaultType: "ingreso" | "egreso";
  categorias: string[];
}

export default function NuevoMovimientoBancoModal({
  accountId,
  defaultType,
  categorias,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDeposit = defaultType === "ingreso";
  const today = new Date().toISOString().slice(0, 10);

  const [categoria, setCategoria] = useState(categorias[0] || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(isDeposit ? "deposito" : "transferencia");

  function handleOpen() {
    setCategoria(categorias[0] || "");
    setAmount("");
    setDate(today);
    setReference("");
    setDescription("");
    setPaymentMethod(isDeposit ? "deposito" : "transferencia");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!categoria || numAmount <= 0) {
      setErrorMsg("Completa la categoría y un monto mayor a cero.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await addBankTransactionAction({
        account_id: accountId,
        type: defaultType,
        amount: numAmount,
        date,
        categoria,
        description: description.trim() || categoria,
        reference: reference.trim() || null,
        payment_method: paymentMethod,
        status: "confirmado",
      });
      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el movimiento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer ${
          isDeposit
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-red-600 hover:bg-red-700 text-white"
        }`}
      >
        {isDeposit ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        <span>{isDeposit ? "+ Registrar Depósito" : "+ Registrar Egreso"}</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isDeposit ? "Registrar Depósito Manual" : "Registrar Egreso / Pago Manual"}
        subtitle="Movimiento administrativo no vinculado automáticamente a facturas o compras"
        icon={isDeposit ? <TrendingUp size={18} className="text-green-600" /> : <TrendingDown size={18} className="text-red-600" />}
        loading={loading}
        loadingText="Registrando transacción y actualizando balance..."
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-600 hover:bg-lilac-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                isDeposit ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              <Save size={14} /> {isDeposit ? "Confirmar Depósito" : "Confirmar Egreso"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Motivo / Categoría <span className="text-red-500">*</span>
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Monto ($) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 text-sm font-bold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition font-mono font-bold"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1.5">
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              N° Comprobante / Referencia bancaria
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: Depósito #458921, Ref #9001..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              Descripción detallada (Opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre el motivo o beneficiario..."
              className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </form>
      </StandardModal>
    </>
  );
}
