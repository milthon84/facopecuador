"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Send, 
  MessageCircle, 
  Mail, 
  Calculator, 
  CreditCard, 
  Banknote, 
  CheckCircle2, 
  Info,
  Search
} from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "tarjeta">("efectivo");
  const [cashDiscountPercent, setCashDiscountPercent] = useState<number>(6.0);
  const [sendEmail, setSendEmail] = useState<boolean>(!!patientEmail);
  const [openWhatsApp, setOpenWhatsApp] = useState<boolean>(!!patientPhone);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const supabase = createClient();
      supabase.from("sri_configs").select("cash_discount_percent, card_surcharge_percent").maybeSingle().then(({ data }) => {
        if (data) {
          const val = Number(data.cash_discount_percent ?? data.card_surcharge_percent ?? 6.0);
          if (val > 0) setCashDiscountPercent(val);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const discount = paymentMethod === "efectivo" ? Math.round(subtotal * (cashDiscountPercent / 100) * 100) / 100 : 0;
  const total = Math.round((subtotal - discount) * 100) / 100;

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
        discount,
        total,
        notes: notes.trim() || undefined,
        sendEmail
      });

      if (!res.success) {
        setErrorMsg(res.error || "Ocurrió un error al guardar la cotización.");
        setLoading(false);
        return;
      }

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
    <div className="fixed inset-0 z-[999] bg-ink-950/70 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full max-w-4xl my-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Elegante */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-lilac-900 via-lilac-800 to-ink-950 text-white flex items-center justify-between border-b border-lilac-700/50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-gold-400 shadow-inner shrink-0">
              <Calculator size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Nueva Cotización Odontológica</h2>
              </div>
              <p className="text-xs text-lilac-200 font-medium">
                Paciente: <span className="text-white font-bold">{patientName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-lilac-200 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-2xs">
              <Info size={15} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Toolbar: Importar Odontograma & Catálogo Completo */}
          <div className="bg-lilac-50/40 border border-lilac-100 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleImportOdontogram}
              className="px-3.5 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-ink-950 font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer border border-gold-400/50"
            >
              <Sparkles size={15} className="text-ink-950" />
              <span>Importar desde Odontograma</span>
            </button>

            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-lilac-500">
                <Search size={14} />
              </div>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const [name, priceStr] = e.target.value.split("||");
                  handleAddCatalogTreatment(name, Number(priceStr));
                  e.target.value = "";
                }}
                className="w-full pl-9 pr-4 py-2 bg-white border border-lilac-200 text-ink-900 text-xs font-semibold rounded-xl outline-none focus:ring-2 focus:ring-lilac-500/20 focus:border-lilac-500 shadow-2xs cursor-pointer transition-all"
              >
                <option value="" disabled>Seleccionar del Catálogo Completo (30+ Tratamientos)...</option>
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

          {/* Tarjetas de Forma de Pago (UBICADAS ARRIBA DE LA TABLA) */}
          <div className="bg-lilac-50/40 border border-lilac-100 rounded-2xl p-3 space-y-2">
            <span className="text-[11px] font-extrabold text-ink-800 uppercase tracking-wider block">
              1. Seleccionar Forma de Pago Prevista:
            </span>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div
                onClick={() => setPaymentMethod("efectivo")}
                className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  paymentMethod === "efectivo"
                    ? "bg-green-50 border-green-600 shadow-2xs"
                    : "bg-white border-lilac-100 hover:border-lilac-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${paymentMethod === "efectivo" ? "bg-green-600 text-white" : "bg-lilac-100 text-ink-500"}`}>
                    <Banknote size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-ink-950 block">Al Contado / Transferencia</span>
                    <span className="text-[10px] text-green-700 font-bold">-{cashDiscountPercent}% Descuento Aplicado en Tabla</span>
                  </div>
                </div>
                {paymentMethod === "efectivo" && <CheckCircle2 size={16} className="text-green-600 shrink-0" />}
              </div>

              <div
                onClick={() => setPaymentMethod("tarjeta")}
                className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                  paymentMethod === "tarjeta"
                    ? "bg-lilac-50 border-lilac-700 shadow-2xs"
                    : "bg-white border-lilac-100 hover:border-lilac-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${paymentMethod === "tarjeta" ? "bg-lilac-800 text-white" : "bg-lilac-100 text-ink-500"}`}>
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-ink-950 block">Tarjeta de Crédito / Débito</span>
                    <span className="text-[10px] text-ink-500 font-semibold">Tarifa PVP normal sin descuento</span>
                  </div>
                </div>
                {paymentMethod === "tarjeta" && <CheckCircle2 size={16} className="text-lilac-700 shrink-0" />}
              </div>
            </div>
          </div>

          {/* Tabla de Tratamientos con Descuento Visible por Ítem */}
          <div className="bg-white border border-lilac-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-lilac-50/60 border-b border-lilac-100 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-ink-800 uppercase tracking-wider">
                2. Tratamientos y Procedimientos Cotizados:
              </span>
              {paymentMethod === "efectivo" && (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-md">
                  ✨ Precios con -{cashDiscountPercent}% Desc. al contado incluidos
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-lilac-50/80 text-ink-700 font-bold text-[11px] uppercase tracking-wider border-b border-lilac-100">
                  <tr>
                    <th className="p-3 w-28">Pieza / Diente</th>
                    <th className="p-3">Tratamiento / Procedimiento</th>
                    <th className="p-3 w-20 text-center">Cant.</th>
                    <th className="p-3 w-28 text-right">P. Unit ($)</th>
                    <th className="p-3 w-36 text-right">Subtotal ($)</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-lilac-50 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center bg-lilac-50/10">
                        <div className="max-w-md mx-auto space-y-1.5">
                          <p className="text-xs font-bold text-ink-800">No hay tratamientos agregados en la cotización</p>
                          <p className="text-[11px] text-ink-500">
                            Selecciona tratamientos del catálogo desplegable arriba, importa del odontograma o haz clic en <strong>"Añadir Fila"</strong>.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const itemSubtotalBase = (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);
                      const itemDiscount = paymentMethod === "efectivo" ? Math.round(itemSubtotalBase * (cashDiscountPercent / 100) * 100) / 100 : 0;
                      const itemSubtotalFinal = Math.round((itemSubtotalBase - itemDiscount) * 100) / 100;

                      return (
                        <tr key={idx} className="hover:bg-lilac-50/20 transition-colors">
                          <td className="p-2">
                            <input
                              type="text"
                              placeholder="Ej: 16, 28"
                              value={item.tooth || ""}
                              onChange={(e) => handleUpdateItem(idx, "tooth", e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-lilac-50/40 border border-lilac-200 rounded-xl text-xs outline-none focus:border-lilac-500 focus:bg-white font-mono font-bold text-lilac-900 placeholder:font-normal placeholder:text-ink-300 transition"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              required
                              placeholder="Nombre del tratamiento o procedimiento"
                              value={item.treatment}
                              onChange={(e) => handleUpdateItem(idx, "treatment", e.target.value)}
                              className="w-full px-3 py-1.5 border border-lilac-200 rounded-xl text-xs outline-none focus:border-lilac-500 focus:bg-white text-ink-950 font-medium placeholder:text-ink-300 transition"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              required
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, "quantity", e.target.value)}
                              className="w-full px-2 py-1.5 border border-lilac-200 rounded-xl text-xs text-center outline-none focus:border-lilac-500 font-semibold text-ink-900"
                            />
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <span className="absolute left-2.5 top-1.5 text-xs text-ink-400 font-semibold">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                required
                                value={item.unitPrice}
                                onChange={(e) => handleUpdateItem(idx, "unitPrice", e.target.value)}
                                className="w-full pl-6 pr-2 py-1.5 border border-lilac-200 rounded-xl text-xs text-right outline-none focus:border-lilac-500 font-mono font-bold text-ink-900"
                              />
                            </div>
                          </td>
                          <td className="p-2 text-right">
                            {paymentMethod === "efectivo" && itemDiscount > 0 ? (
                              <div>
                                <div className="text-[11px] text-ink-400 line-through font-mono">
                                  ${itemSubtotalBase.toFixed(2)}
                                </div>
                                <div className="font-mono font-black text-green-700 text-sm">
                                  ${itemSubtotalFinal.toFixed(2)}
                                </div>
                                <span className="inline-block text-[9px] font-extrabold text-green-800 bg-green-100 border border-green-200 px-1.5 py-0.2 rounded">
                                  -${itemDiscount.toFixed(2)} (-{cashDiscountPercent}%)
                                </span>
                              </div>
                            ) : (
                              <div className="font-mono font-extrabold text-ink-950 text-sm">
                                ${itemSubtotalBase.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              title="Eliminar fila"
                              className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pie de Tabla */}
            <div className="p-2.5 bg-lilac-50/40 border-t border-lilac-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-lilac-100 hover:bg-lilac-200 text-lilac-900 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer border border-lilac-200 w-fit"
              >
                <Plus size={14} className="text-lilac-700" />
                <span>Añadir Fila de Tratamiento</span>
              </button>

              <div className="text-xs font-bold text-ink-700 text-right space-y-0.5">
                <div>
                  Subtotal PVP Normal: <span className="text-ink-950 font-mono text-xs font-bold ml-1">${(Number(subtotal) || 0).toFixed(2)} USD</span>
                </div>
                {paymentMethod === "efectivo" && discount > 0 && (
                  <div className="text-green-700 font-bold">
                    Descuento al Contado (-{cashDiscountPercent}%): <span className="font-mono text-xs ml-1">-${discount.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="text-sm font-black text-ink-950 border-t border-lilac-200 pt-1 mt-1">
                  Subtotal Neto Ítems: <span className="text-lilac-900 font-mono text-base font-black ml-1">${total.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Observaciones (Compacto) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold text-ink-700 uppercase tracking-wider">
              3. Observaciones / Notas Adicionales (Opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Incluye rx panorámica / Validez 15 días / Pago 50% anticipo"
              className="w-full px-3 py-2 text-xs border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-500/20 focus:border-lilac-500 bg-white font-medium text-ink-950 placeholder:text-ink-300"
            />
          </div>

          {/* Panel Unificado Final: Canales de Envío, Totales Claros y Botones de Acción */}
          <div className="bg-white border-2 border-lilac-200 rounded-2xl p-4 shadow-md space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-lilac-100 pb-3">
              {/* Canales de Envío Directo */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-700 block">Enviar cotización por:</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    sendEmail ? "bg-lilac-50 border-lilac-300 text-lilac-950" : "bg-gray-50 border-gray-200 text-ink-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      disabled={!patientEmail}
                      className="rounded text-lilac-600 focus:ring-lilac-500 w-4 h-4"
                    />
                    <Mail size={15} className={sendEmail ? "text-lilac-700" : "text-ink-400"} />
                    <span>Correo {patientEmail ? `(${patientEmail})` : "(Sin email)"}</span>
                  </label>

                  <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    openWhatsApp ? "bg-green-50 border-green-300 text-green-950" : "bg-gray-50 border-gray-200 text-ink-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={openWhatsApp}
                      onChange={(e) => setOpenWhatsApp(e.target.checked)}
                      disabled={!patientPhone}
                      className="rounded text-green-600 focus:ring-green-500 w-4 h-4"
                    />
                    <MessageCircle size={15} className={openWhatsApp ? "text-green-600" : "text-ink-400"} />
                    <span>WhatsApp {patientPhone ? `(${patientPhone})` : "(Sin teléfono)"}</span>
                  </label>
                </div>
              </div>

              {/* Totales en Fuente Clara de Alta Legibilidad */}
              <div className="text-right space-y-0.5">
                <div className="text-xs text-ink-700 font-semibold">
                  Subtotal Tratamientos: <span className="font-mono font-bold text-ink-950">${subtotal.toFixed(2)} USD</span>
                </div>
                {discount > 0 && (
                  <div className="text-xs text-green-700 font-bold">
                    Desc. Contado ({cashDiscountPercent}%): <span className="font-mono">-${discount.toFixed(2)} USD</span>
                  </div>
                )}
                <div className="text-2xl font-black text-ink-950 tracking-tight font-mono pt-1">
                  TOTAL: <span className="text-lilac-900">${total.toFixed(2)} USD</span>
                </div>
              </div>
            </div>

            {/* Acciones de Cierre */}
            <div className="flex items-center justify-end gap-3 pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-ink-700 hover:text-ink-950 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-lilac-900 hover:bg-lilac-950 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>Procesando Cotización...</>
                ) : (
                  <>
                    <Send size={15} /> Guardar y Enviar Cotización
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
