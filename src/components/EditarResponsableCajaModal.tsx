"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, AlertCircle, Save } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateResponsableCajaChicaAction } from "@/app/(admin)/erp/caja-chica/actions";
import { ResponsableCajaChica } from "@/lib/caja-chica-types";

interface Props {
  cajaId: string;
  cajaName: string;
  initialResponsable: ResponsableCajaChica | null;
}

export default function EditarResponsableCajaModal({
  cajaId,
  cajaName,
  initialResponsable,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [nombre, setNombre] = useState(initialResponsable?.nombre || "");
  const [identificacion, setIdentificacion] = useState(initialResponsable?.identificacion || "");
  const [banco, setBanco] = useState(initialResponsable?.banco || "Banco Pichincha");
  const [cuenta, setCuenta] = useState(initialResponsable?.cuenta || "");
  const [tipoCuenta, setTipoCuenta] = useState(initialResponsable?.tipo_cuenta || "Ahorros");
  const [telefono, setTelefono] = useState(initialResponsable?.telefono || "");

  function handleOpen() {
    setNombre(initialResponsable?.nombre || "");
    setIdentificacion(initialResponsable?.identificacion || "");
    setBanco(initialResponsable?.banco || "Banco Pichincha");
    setCuenta(initialResponsable?.cuenta || "");
    setTipoCuenta(initialResponsable?.tipo_cuenta || "Ahorros");
    setTelefono(initialResponsable?.telefono || "");
    setErrorMsg(null);
    setIsOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg("El nombre del custodio responsable es obligatorio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await updateResponsableCajaChicaAction({
        caja_id: cajaId,
        nombre: nombre.trim(),
        identificacion: identificacion.trim(),
        banco: banco.trim(),
        cuenta: cuenta.trim(),
        tipo_cuenta: tipoCuenta,
        telefono: telefono.trim(),
      });

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar el responsable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-lilac-700 bg-lilac-50 hover:bg-lilac-100 border border-lilac-200 transition shadow-2xs cursor-pointer"
      >
        <UserCheck size={14} className="text-lilac-600" />
        <span>{initialResponsable?.nombre ? "Editar Custodio" : "Asignar Custodio"}</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Responsable de Caja Chica"
        subtitle={`Custodio titular para el fondo fijo y reposiciones de ${cajaName}`}
        icon={<UserCheck size={20} className="text-lilac-600" />}
        loading={loading}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-lilac-50/50 border border-lilac-100 rounded-xl p-3 text-xs text-ink-600">
            <p className="font-semibold text-ink-900 mb-0.5">ℹ️ Custodio Oficial</p>
            <p>
              A esta persona se le realizarán las transferencias de reposición desde las cuentas
              bancarias de Niagas para mantener el fondo de caja chica.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Nombre y Apellidos del Responsable *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Milton Aguilera"
              disabled={loading}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Cédula / Identificación
              </label>
              <input
                type="text"
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                placeholder="1790483851"
                disabled={loading}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Teléfono de contacto
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="0991234567"
                disabled={loading}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-lilac-100 space-y-3">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
              Cuenta Personal para Depósitos / Reposiciones
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Banco Personal
                </label>
                <input
                  type="text"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Ej. Banco Pichincha"
                  disabled={loading}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Tipo de Cuenta
                </label>
                <select
                  value={tipoCuenta}
                  onChange={(e) => setTipoCuenta(e.target.value)}
                  disabled={loading}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                >
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                N° de Cuenta donde se deposita
              </label>
              <input
                type="text"
                value={cuenta}
                onChange={(e) => setCuenta(e.target.value)}
                placeholder="2201928374"
                disabled={loading}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
              />
            </div>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-lilac-600 hover:bg-lilac-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              <span>Guardar Custodio</span>
            </button>
          </div>
        </form>
      </StandardModal>
    </>
  );
}
