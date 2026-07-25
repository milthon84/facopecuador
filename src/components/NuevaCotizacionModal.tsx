"use client";

import { useState } from "react";
import { X, Plus, Trash2, Sparkles, Send, MessageCircle, Mail, Calculator } from "lucide-react";
import { createPatientQuotationAction, getPatientOdontogramStateAction } from "@/app/(admin)/erp/pacientes/actions";
import { QuotationItem } from "@/lib/email";
import { createClient } from "@/lib/supabase/client";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  odontogramState?: Record<string, any> | null;
}

const FULL_CATALOG = [
  {
    category: "Prevención e Higiene",
    items: [
      { name: "Profilaxis y Limpieza Dental Profunda", price: 35 },
      { name: "Destartraje Ultrasónico", price: 40 },
      { name: "Sellante Preventivo de Fosas y Fisuras", price: 25 },
      { name: "Fluorización Tópica en Gel / Barniz", price: 20 },
    ]
  },
  {
    category: "Operatoria y Estética",
    items: [
      { name: "Resina Estética / Calza Fotocurada", price: 45 },
      { name: "Resina Compleja Multi-Superficie", price: 60 },
      { name: "Incrustación Estética (Inlay / Onlay)", price: 140 },
      { name: "Blanqueamiento Dental LED en Consultorio", price: 150 },
      { name: "Blanqueamiento Dental Casero con Cubetas", price: 100 },
    ]
  },
  {
    category: "Endodoncia",
    items: [
      { name: "Endodoncia Unirradicular", price: 120 },
      { name: "Endodoncia Birradicular", price: 150 },
      { name: "Endodoncia Multirradicular", price: 180 },
      { name: "Re-tratamiento de Endodoncia", price: 220 },
    ]
  },
  {
    category: "Prótesis y Rehabilitación",
    items: [
      { name: "Corona de Zirconio / Porcelana", price: 250 },
      { name: "Corona Metal Porcelana", price: 190 },
      { name: "Prótesis Parcial Flexible Valplast", price: 280 },
      { name: "Prótesis Parcial Metálica (Esquelético)", price: 320 },
      { name: "Prótesis Total Removible (Sup/Inf)", price: 300 },
      { name: "Implante Dental de Titanio", price: 650 },
      { name: "Rehabilitación sobre Implante", price: 350 },
    ]
  },
  {
    category: "Cirugía Bucal",
    items: [
      { name: "Extracción Dental Simple", price: 30 },
      { name: "Extracción Quirúrgica (Tercer Molar / Cordal)", price: 90 },
      { name: "Extracción Quirúrgica Compleja", price: 120 },
      { name: "Gingivectomía / Cirugía Gingival", price: 80 },
    ]
  },
  {
    category: "Ortodoncia y Periodoncia",
    items: [
      { name: "Brackets Metálicos (Instalación)", price: 350 },
      { name: "Brackets Estéticos Zafiro (Instalación)", price: 500 },
      { name: "Control / Ajuste Mensual de Ortodoncia", price: 40 },
      { name: "Placa Miorelajante / Plano de Bruxismo", price: 110 },
      { name: "Curetaje y Alisado Radicular (por cuadrante)", price: 70 },
    ]
  }
];

export default function NuevaCotizacionModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  patientPhone,
  patientEmail,
  odontogramState,
}: Props) {
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [sendEmail, setSendEmail] = useState<boolean>(!!patientEmail);
  const [openWhatsApp, setOpenWhatsApp] = useState<boolean>(!!patientPhone);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculateSubtotal = () => {
    return items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const subtotal = calculateSubtotal();
  const total = subtotal;

  const handleAddItem = () => {
    setItems([
      ...items,
      { tooth: "", treatment: "", quantity: 1, unitPrice: 0, subtotal: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof QuotationItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) : item.quantity;
      const p = field === "unitPrice" ? Number(value) : item.unitPrice;
      item.subtotal = q * p;
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const handleAddCatalogTreatment = (name: string, price: number) => {
    setItems([
      ...items,
      { tooth: "", treatment: name, quantity: 1, unitPrice: price, subtotal: price }
    ]);
  };

  const handleImportOdontogram = async () => {
    let stateToUse = odontogramState;

    if (!stateToUse || Object.keys(stateToUse).length === 0) {
      try {
        const res = await getPatientOdontogramStateAction(patientId);
        if (res.success && res.odontogramState) {
          stateToUse = res.odontogramState;
        }
      } catch (e) {
        console.error("Error al obtener odontograma:", e);
      }
    }

    if (!stateToUse || Object.keys(stateToUse).length === 0) {
      alert("No hay hallazgos o tratamientos registrados en el odontograma actual del paciente.");
      return;
    }

    const surfaceNames: Record<string, string> = {
      center: "Centro",
      top: "Superior",
      bottom: "Inferior",
      left: "Izquierda",
      right: "Derecha"
    };

    const importedItems: QuotationItem[] = [];
    const toothStates: Record<string, { treatment: string; price: number }> = {
      caries: { treatment: "Resina Estética / Calza Fotocurada", price: 45 },
      sellante_necesario: { treatment: "Sellante Preventivo", price: 25 },
      obturacion_mala: { treatment: "Recambio de Obturación / Resina", price: 45 },
      corona: { treatment: "Corona de Zirconio / Porcelana", price: 250 },
      endodoncia_nec: { treatment: "Endodoncia / Tratamiento de Conductos", price: 150 },
      extraccion: { treatment: "Extracción Dental Requerida", price: 40 },
      perdida_caries: { treatment: "Rehabilitación por Pérdida Dental", price: 300 }
    };

    Object.entries(stateToUse).forEach(([toothNum, info]: [string, any]) => {
      if (info.general && info.general !== "sano" && toothStates[info.general]) {
        const spec = toothStates[info.general];
        importedItems.push({
          tooth: toothNum,
          treatment: spec.treatment,
          quantity: 1,
          unitPrice: spec.price,
          subtotal: spec.price
        });
      }

      Object.entries(info.surfaces || {}).forEach(([surf, cond]: [string, any]) => {
        if (cond && cond !== "sano" && toothStates[cond]) {
          const spec = toothStates[cond];
          const surfEs = surfaceNames[surf] || surf;
          importedItems.push({
            tooth: toothNum,
            treatment: `${spec.treatment} (${surfEs})`,
            quantity: 1,
            unitPrice: spec.price,
            subtotal: spec.price
          });
        }
      });
    });

    if (importedItems.length === 0) {
      alert("El odontograma está sano o no contiene piezas marcadas con caries, coronas o extracciones.");
      return;
    }

    setItems([...items.filter(i => i.treatment !== ""), ...importedItems]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validItems = items.filter(i => i.treatment.trim() !== "");
    if (validItems.length === 0) {
      setErrorMsg("Debe agregar al menos un tratamiento en la cotización.");
      return;
    }

    setLoading(true);
    try {
      const res = await createPatientQuotationAction({
        patientId,
        items: validItems,
        subtotal,
        discount: 0,
        total,
        notes: notes.trim() || undefined,
        sendEmail
      });

      if (!res.success) {
        setErrorMsg(res.error || "Ocurrió un error al guardar la cotización.");
        setLoading(false);
        return;
      }

      // If user selected WhatsApp, open WhatsApp link
      if (openWhatsApp && res.whatsappUrl) {
        window.open(res.whatsappUrl, "_blank");
      }

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al procesar el envío.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-lilac-900 via-lilac-800 to-ink-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <Calculator size={20} className="text-gold-400" />
            </div>
            <div>
              <h2 className="text-base font-bold">Nueva Cotización Odontológica</h2>
              <p className="text-xs text-lilac-200">Paciente: {patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-lilac-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Quick Toolbar: Import Odontogram & Complete Catalog Selector */}
          <div className="p-3 bg-lilac-50/60 border border-lilac-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleImportOdontogram}
              className="px-3 py-2 bg-white border border-gold-300 text-gold-900 hover:bg-gold-50 text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Sparkles size={15} className="text-gold-600" /> Importar Odontograma
            </button>

            <div className="flex-1 min-w-[280px]">
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [name, priceStr] = e.target.value.split("||");
                  handleAddCatalogTreatment(name, Number(priceStr));
                  e.target.value = "";
                }}
                className="w-full px-3 py-2 bg-white border border-lilac-200 text-ink-900 text-xs font-semibold rounded-xl outline-none focus:border-lilac-500 shadow-2xs cursor-pointer"
              >
                <option value="" disabled>🔍 Seleccionar del Catálogo Completo (30+ Tratamientos)...</option>
                {FULL_CATALOG.map((cat, cIdx) => (
                  <optgroup key={cIdx} label={`--- ${cat.category} ---`}>
                    {cat.items.map((t, tIdx) => (
                      <option key={tIdx} value={`${t.name}||${t.price}`}>
                        {t.name} — ${t.price}.00 USD
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-lilac-100 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-lilac-900 text-white font-bold text-[11px] uppercase">
                <tr>
                  <th className="p-3 w-24">Pieza/Diente</th>
                  <th className="p-3">Tratamiento / Procedimiento</th>
                  <th className="p-3 w-20 text-center">Cant.</th>
                  <th className="p-3 w-28 text-right">P. Unit ($)</th>
                  <th className="p-3 w-28 text-right">Subtotal ($)</th>
                  <th className="p-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-100 bg-white">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-ink-500 bg-lilac-50/20 text-xs">
                      💡 No hay tratamientos en la cotización. Selecciona un tratamiento del <strong>catálogo desplegable arriba</strong>, presiona <strong>"Importar Odontograma"</strong> o haz clic en <strong>"+ Añadir Fila de Tratamiento"</strong>.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-lilac-50/30 transition-colors">
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Ej. 16, 28"
                          value={item.tooth || ""}
                          onChange={(e) => handleUpdateItem(idx, "tooth", e.target.value)}
                          className="w-full px-2 py-1 border border-lilac-200 rounded-lg text-xs outline-none focus:border-lilac-500 font-semibold text-lilac-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          placeholder="Descripción del tratamiento"
                          value={item.treatment}
                          onChange={(e) => handleUpdateItem(idx, "treatment", e.target.value)}
                          className="w-full px-2.5 py-1 border border-lilac-200 rounded-lg text-xs outline-none focus:border-lilac-500 text-ink-900"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={1}
                          required
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1 border border-lilac-200 rounded-lg text-xs text-center outline-none focus:border-lilac-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          required
                          value={item.unitPrice}
                          onChange={(e) => handleUpdateItem(idx, "unitPrice", e.target.value)}
                          className="w-full px-2 py-1 border border-lilac-200 rounded-lg text-xs text-right outline-none focus:border-lilac-500 font-semibold"
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-ink-900">
                        ${(Number(item.subtotal) || 0).toFixed(2)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="p-2.5 bg-lilac-50/50 border-t border-lilac-100 flex justify-between items-center">
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-lilac-800 text-white hover:bg-lilac-900 text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Añadir Fila de Tratamiento
              </button>
              <div className="text-xs font-bold text-ink-700">
                Subtotal Ítems: <span className="text-lilac-900 text-sm font-extrabold">${(Number(subtotal) || 0).toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* Optional Notes / Observaciones */}
          <div>
            <label className="block text-[11px] font-bold text-ink-600 uppercase mb-1">
              Observaciones / Notas Adicionales (Opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Incluye rx panorámica / Validez 15 días / Pago 50% anticipo"
              className="w-full px-3 py-2 text-xs border border-lilac-200 rounded-xl outline-none focus:border-lilac-500 bg-white"
            />
          </div>

          {/* Total & Send Options Compact Bar */}
          <div className="p-3.5 bg-gradient-to-r from-lilac-50 to-gold-50/50 border border-lilac-100 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <span className="text-xs font-bold text-ink-700 uppercase">Enviar por:</span>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink-800">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={!patientEmail}
                  className="rounded text-lilac-600 focus:ring-lilac-500 w-4 h-4"
                />
                <Mail size={15} className={patientEmail ? "text-lilac-600" : "text-ink-300"} />
                Correo {patientEmail ? `(${patientEmail})` : "(Sin email)"}
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink-800">
                <input
                  type="checkbox"
                  checked={openWhatsApp}
                  onChange={(e) => setOpenWhatsApp(e.target.checked)}
                  disabled={!patientPhone}
                  className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                />
                <MessageCircle size={15} className={patientPhone ? "text-green-600" : "text-ink-300"} />
                WhatsApp {patientPhone ? `(${patientPhone})` : "(Sin cel)"}
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-ink-600 uppercase">TOTAL ESTIMADO:</span>
              <span className="text-lg font-black text-lilac-950">${(Number(subtotal) || 0).toFixed(2)} USD</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-ink-700 hover:bg-ink-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-lilac-800 to-gold-600 hover:from-lilac-900 hover:to-gold-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>Procesando...</>
              ) : (
                <>
                  <Send size={15} /> Guardar y Enviar Cotización
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
