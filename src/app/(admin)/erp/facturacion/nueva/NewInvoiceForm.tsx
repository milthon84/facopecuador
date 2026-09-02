"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Send, FileText, User, X, BookOpen, ChevronDown, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Paperclip } from "lucide-react";
import { validateDocumento, validateEmail, validateTelefono, isPassportDocument } from "@/lib/validators";
import { createClient } from "@/lib/supabase/client";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  iva_code: "4" | "0";
}

interface Patient {
  id: string;
  full_name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  iva_code: string;
  category: string;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string | null;
  account_type: string; // ahorros | corriente | caja
  notes?: string | null;
}

const PAYMENT_METHODS = [
  { value: "efectivo",        label: "Efectivo",                 sriCode: "01" },
  { value: "transferencia",   label: "Transferencia / Depósito", sriCode: "20" },
  { value: "tarjeta_credito", label: "Tarjeta de Crédito",       sriCode: "19" },
];

export default function NewInvoiceForm({
  patients,
  initialPatient,
  services = [],
  bankAccounts = [],
  cashDiscountPercent = 6.0,
  cardSurchargePercent,
  appointmentId = null,
  initialClientName = "",
  initialClientDocument = "",
  initialClientEmail = "",
  initialClientPhone = "",
  initialClientAddress = "",
  initialModuleEnrollmentIds = "",
  initialCourseEnrollmentId = "",
  initialFullCoursePayment = false,
  initialItemDescription = "",
  initialItemPrice = 0,
  returnUrl = "",
}: {
  patients: Patient[];
  initialPatient: Patient | null;
  services?: Service[];
  bankAccounts?: BankAccount[];
  cashDiscountPercent?: number;
  cardSurchargePercent?: number;
  appointmentId?: string | null;
  initialClientName?: string;
  initialClientDocument?: string;
  initialClientEmail?: string;
  initialClientPhone?: string;
  initialClientAddress?: string;
  initialModuleEnrollmentIds?: string;
  initialCourseEnrollmentId?: string;
  initialFullCoursePayment?: boolean;
  initialItemDescription?: string;
  initialItemPrice?: number;
  returnUrl?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paymentMethod,    setPaymentMethod]    = useState("efectivo");
  const [bankAccountId,    setBankAccountId]    = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [cardType,         setCardType]         = useState("");
  const [cardLote,         setCardLote]         = useState("");
  const [cardVoucher,      setCardVoucher]      = useState("");

  // Lookup local (pacientes + facturas previas)
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [lookupSource, setLookupSource] = useState<"patient" | "patient+invoice" | "invoice" | null>(null);

  // Comprobante de pago
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<InvoiceItem[]>(
    initialItemDescription
      ? [{ id: Math.random().toString(), description: initialItemDescription, quantity: 1, unit_price: initialItemPrice, discount: 0, iva_code: "4" }]
      : []
  );

  const [patientId,      setPatientId]      = useState(initialPatient?.id ?? "");
  const [clientName,     setClientName]     = useState(initialClientName || initialPatient?.full_name || "");
  const [clientDocument, setClientDocument] = useState(initialClientDocument || initialPatient?.document_number || "");
  const [isPassport,     setIsPassport]     = useState(() => isPassportDocument(initialClientDocument || initialPatient?.document_number || ""));
  const [clientEmail,    setClientEmail]    = useState(initialClientEmail || initialPatient?.email || "");
  const [clientPhone,    setClientPhone]    = useState(initialClientPhone || initialPatient?.phone || "");
  const [clientAddress,  setClientAddress]  = useState(initialClientAddress || "");
  const [moduleEnrollmentIds] = useState<string[]>(
    initialModuleEnrollmentIds ? initialModuleEnrollmentIds.split(",") : []
  );

  // Cargar dirección y datos desde última factura de forma automática
  useEffect(() => {
    if (clientDocument) {
      const clean = clientDocument.replace(/[\s\-]/g, "");
      if (isPassport || /^\d{10}$/.test(clean) || /^\d{13}$/.test(clean)) {
        fetch(`/api/admin/client-lookup?document=${clean}`)
          .then(res => res.json())
          .then(data => {
            if (data.found) {
              if (data.address) setClientAddress(data.address);
              if (data.name && !clientName) setClientName(data.name);
              if (data.email && !clientEmail) setClientEmail(data.email);
              if (data.phone && !clientPhone) setClientPhone(data.phone);
              setLookupStatus("found");
              setLookupSource(data.source);
            }
          })
          .catch(err => console.error("Error al buscar dirección de cliente:", err));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientDocument, isPassport]);

  // Búsqueda de paciente
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredPatients = search.length >= 2
    ? patients.filter(p =>
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.document_number ?? "").includes(search)
      ).slice(0, 8)
    : [];

  function selectPatient(p: Patient) {
    setPatientId(p.id);
    setClientName(p.full_name);
    setClientDocument(p.document_number ?? "");
    setClientEmail(p.email ?? "");
    setClientPhone(p.phone ?? "");
    setSearch("");
    setShowSearch(false);
    setIsPassport(isPassportDocument(p.document_number ?? ""));
  }

  function clearPatient() {
    setPatientId("");
    setClientName("");
    setClientDocument("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
    setSearch("");
    setLookupStatus("idle");
    setLookupSource(null);
    setIsPassport(false);
  }

  async function lookupByDocument(doc: string) {
    const clean = doc.trim();
    if (clean.length < 3) return;

    setLookupStatus("loading");
    setLookupSource(null);
    try {
      const res  = await fetch(`/api/admin/client-lookup?document=${clean}`);
      const data = await res.json();

      if (!data.found) {
        setLookupStatus("not_found");
        return;
      }

      // Auto-completar campos con los datos encontrados
      if (data.patient_id) setPatientId(data.patient_id);
      if (data.name)    setClientName(data.name);
      if (data.email)   setClientEmail(data.email);
      if (data.phone)   setClientPhone(data.phone);
      if (data.address) setClientAddress(data.address);

      setLookupStatus("found");
      setLookupSource(data.source);
      setIsPassport(isPassportDocument(clean));
    } catch {
      setLookupStatus("idle");
    }
  }

  const discountRate = cashDiscountPercent ?? cardSurchargePercent ?? 6.0;
  const isCashOrTransfer = paymentMethod === "efectivo" || paymentMethod === "transferencia";

  const calcAutoDiscount = (q: number, pu: number) => {
    if (!isCashOrTransfer || discountRate <= 0) return 0;
    return Math.round((q * pu) * (discountRate / 100) * 100) / 100;
  };

  // Re-calcular los descuentos automáticamente al cambiar la forma de pago
  useEffect(() => {
    setItems(prev => prev.map(item => ({
      ...item,
      discount: isCashOrTransfer ? Math.round((item.quantity * item.unit_price) * (discountRate / 100) * 100) / 100 : 0
    })));
  }, [paymentMethod, discountRate]);

  function addFromCatalog(s: Service) {
    const price = Number(s.price);
    const autoDisc = calcAutoDiscount(1, price);
    setItems(prev => [...prev, {
      id:          Math.random().toString(),
      description: s.name,
      quantity:    1,
      unit_price:  price,
      discount:    autoDisc,
      iva_code:    s.iva_code === "4" ? "4" : "0",
    }]);
    setShowCatalog(false);
  }

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: "", quantity: 1, unit_price: 0, discount: 0, iva_code: "4" }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    setFormErrors(p => { const n = { ...p }; delete n.items; return n; });
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    const updated = items.map(i => {
      if (i.id !== id) return i;
      const updatedItem = { ...i, [field]: value };
      if (isCashOrTransfer && (field === "quantity" || field === "unit_price")) {
        updatedItem.discount = Math.round((updatedItem.quantity * updatedItem.unit_price) * (discountRate / 100) * 100) / 100;
      }
      return updatedItem;
    });
    setItems(updated);
    if (updated.some(i => i.description.trim() && i.unit_price > 0)) {
      setFormErrors(p => { const n = { ...p }; delete n.items; return n; });
    }
  };

  const subtotal15     = items.filter(i => i.iva_code === "4").reduce((acc, i) => acc + ((i.quantity * i.unit_price) - i.discount), 0);
  const subtotal0      = items.filter(i => i.iva_code === "0").reduce((acc, i) => acc + ((i.quantity * i.unit_price) - i.discount), 0);
  const totalDescuento = items.reduce((acc, i) => acc + i.discount, 0);
  const ivaAmount      = subtotal15 * 0.15;
  const totalFactura   = subtotal15 + subtotal0 + ivaAmount;

  const requiresBankConfirmation = paymentMethod !== "efectivo";

  function validateForm(): boolean {
    const e: Record<string, string> = {};

    // Datos del cliente
    if (!clientName.trim() || clientName.trim().length < 2) e.clientName = "Razón social / nombre requerido";
    const docErr = validateDocumento(clientDocument, isPassport);
    if (docErr) e.clientDocument = docErr;
    const emailErr = validateEmail(clientEmail);
    if (emailErr) e.clientEmail = emailErr;
    const telErr = validateTelefono(clientPhone, true);
    if (telErr) e.clientPhone = telErr;

    // Ítems: debe haber al menos uno con descripción y precio mayor a 0
    const validItems = items.filter(i => i.description.trim() && i.unit_price > 0);
    if (validItems.length === 0) {
      e.items = "Agrega al menos un ítem con descripción y precio para facturar";
    }

    // Total debe ser mayor a 0
    if (totalFactura <= 0 && validItems.length > 0) {
      e.items = "El total de la factura debe ser mayor a $0.00";
    }

    // Transferencia/Depósito requiere cuenta
    if (paymentMethod === "transferencia") {
      if (!bankAccountId) e.bankAccountId = "Selecciona la cuenta donde recibiste el pago";
    }

    // Tarjeta de Crédito requiere datos de tarjeta
    if (paymentMethod === "tarjeta_credito") {
      if (!cardType) e.cardType = "Selecciona o escribe el tipo de tarjeta";
      if (!cardLote.trim()) e.cardLote = "El número de lote es obligatorio";
      if (!cardVoucher.trim()) e.cardVoucher = "El número de baucher es obligatorio";
    }

    setFormErrors(e);

    // Auto-limpiar errores después de 5 segundos
    if (Object.keys(e).length > 0) {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setFormErrors({});
        setHasSubmitted(false);
      }, 5000);
    }

    return Object.keys(e).length === 0;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);
    if (!validateForm()) return;
    setLoading(true);
    try {
      // Subir comprobante si existe
      let comprobanteUrl: string | undefined;
      if (comprobanteFile) {
        try {
          const supabase = createClient();
          const ext = comprobanteFile.name.split(".").pop();
          const path = `comprobantes/${Date.now()}.${ext}`;
          const { data: upload } = await supabase.storage
            .from("payment-proofs")
            .upload(path, comprobanteFile, { upsert: true });
          if (upload) {
            const { data: { publicUrl } } = supabase.storage.from("payment-proofs").getPublicUrl(path);
            comprobanteUrl = publicUrl;
          }
        } catch (uErr) {
          console.warn("Error al subir comprobante en creación:", uErr);
        }
      }

      const res = await fetch("/api/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id:        patientId || undefined,
          appointment_id:    appointmentId || undefined,
          client_name:       clientName,
          client_document:   clientDocument,
          client_email:      clientEmail,
          client_phone:      clientPhone,
          client_address:    clientAddress,
          items,
          payment_method:    paymentMethod,
          bank_account_id:   bankAccountId || undefined,
          payment_reference: comprobanteUrl || paymentReference || (paymentMethod === "tarjeta_credito" ? cardVoucher : undefined),
          card_type:         paymentMethod === "tarjeta_credito" ? cardType : undefined,
          card_lote:         paymentMethod === "tarjeta_credito" ? cardLote : undefined,
          card_voucher:      paymentMethod === "tarjeta_credito" ? cardVoucher : undefined,
          comprobante_url:   comprobanteUrl,
          image_url:         comprobanteUrl,
          forma_pago:        PAYMENT_METHODS.find(m => m.value === paymentMethod)?.sriCode ?? "01",
          module_enrollment_ids: moduleEnrollmentIds.length > 0 ? moduleEnrollmentIds : undefined,
          course_enrollment_id: initialCourseEnrollmentId || undefined,
          full_course_payment: initialFullCoursePayment || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar la factura");
      
      const createdInvoiceId = result.invoice_id;

      // Subir comprobante mediante la API del servidor usando admin client
      if (comprobanteFile && createdInvoiceId) {
        try {
          const photoFormData = new FormData();
          photoFormData.append("invoiceId", createdInvoiceId);
          photoFormData.append("title", `Comprobante (${comprobanteFile.name})`);
          photoFormData.append("imageFile", comprobanteFile);

          await fetch("/api/admin/invoice-photos", {
            method: "POST",
            body: photoFormData,
          });
        } catch (photoUploadErr) {
          console.warn("Error al subir foto de comprobante en servidor:", photoUploadErr);
        }
      }
      
      setAlertModal({
        show: true,
        type: "success",
        title: "Factura Emitida con Éxito",
        message: `La factura ha sido emitida, firmada y aprobada correctamente por el SRI Ecuador.\n\nClave de acceso:\n${result.clave_acceso}`,
      });
    } catch (err: any) {
      setAlertModal({
        show: true,
        type: "error",
        title: "Error al Procesar Factura",
        message: err.message || "Ocurrió un error inesperado al emitir la factura.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">

      {/* Overlay de bloqueo durante el procesamiento */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border-4 border-lilac-100 border-t-lilac-600 animate-spin mb-5" />
            <h3 className="text-lg font-bold text-ink-900 mb-2">Procesando Factura</h3>
            <p className="text-sm text-ink-500">
              Firmando y enviando al SRI Ecuador…
            </p>
            <p className="text-xs text-ink-400 mt-2">
              Este proceso puede tardar hasta 30 segundos. No cierres la ventana.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <Link
          href={returnUrl || "/erp/facturacion"}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900">Emitir Nueva Factura</h1>
          <p className="text-xs text-ink-500">Completa los datos para generar el comprobante electrónico SRI.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">

        {/* ── Datos del Cliente ───────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-sm text-ink-700 flex items-center gap-2 mb-4 border-b border-lilac-50 pb-2">
            <User size={15} className="text-lilac-600" />
            Datos del Adquirente
          </h3>

          {/* Indicador de paciente seleccionado */}
          {patientId && (
            <div className="flex items-center justify-between mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              <span><span className="text-green-600 mr-1">✓</span>Paciente: <strong>{clientName}</strong></span>
              <button type="button" onClick={clearPatient} className="text-green-600 hover:text-green-800 ml-2">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Documento con check de pasaporte ── */}
            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink-700">RUC, Cédula o Pasaporte *</label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPassport}
                    onChange={(e) => {
                      setIsPassport(e.target.checked);
                      setClientDocument("");
                      setFormErrors(p => ({ ...p, clientDocument: "" }));
                      if (lookupStatus !== "idle") { setLookupStatus("idle"); setLookupSource(null); }
                    }}
                    className="rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500 h-3.5 w-3.5"
                  />
                  <span className="text-xs font-semibold text-ink-700">Pasaporte</span>
                </label>
              </div>
              <div className="relative">
                <input type="text" required value={clientDocument} maxLength={isPassport ? 20 : 13}
                  onChange={e => {
                    const val = isPassport ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "");
                    setClientDocument(val);
                    setFormErrors(p => ({ ...p, clientDocument: "" }));
                    if (lookupStatus !== "idle") { setLookupStatus("idle"); setLookupSource(null); }
                    if (isPassport) {
                      if (val.length >= 6) {
                        lookupByDocument(val);
                      }
                    } else {
                      if (val.length === 10 || val.length === 13) {
                        const docErr = validateDocumento(val, false);
                        if (!docErr) lookupByDocument(val);
                        else setFormErrors(p => ({ ...p, clientDocument: docErr }));
                      }
                    }
                  }}
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lilac-500 focus:outline-none font-mono pr-9 ${formErrors.clientDocument ? "border-red-400" : lookupStatus === "found" ? "border-green-300" : "border-lilac-200"}`}
                  placeholder={isPassport ? "Pasaporte (Ej: PA987654)" : "Cédula (10 dígitos) o RUC (13 dígitos)"} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {lookupStatus === "loading"   && <Loader2 size={14} className="animate-spin text-lilac-500" />}
                  {lookupStatus === "found"     && <CheckCircle2 size={14} className="text-green-500" />}
                  {lookupStatus === "not_found" && <AlertCircle size={14} className="text-ink-300" />}
                </span>
              </div>
              {formErrors.clientDocument && <p className="text-xs text-red-500">{formErrors.clientDocument}</p>}
              {lookupStatus === "loading"   && <p className="text-xs text-lilac-500 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Buscando en el sistema…</p>}
              {lookupStatus === "found" && lookupSource === "patient"         && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Paciente registrado</p>}
              {lookupStatus === "found" && lookupSource === "patient+invoice" && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Paciente con datos de facturación previa cargados</p>}
              {lookupStatus === "found" && lookupSource === "invoice"         && <p className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={11} /> Datos cargados desde factura anterior</p>}
              {lookupStatus === "not_found" && <p className="text-xs text-ink-400 flex items-center gap-1"><AlertCircle size={11} /> No encontrado — ingresa los datos manualmente</p>}
            </div>

            {/* Razón social — auto-completado si existe en el sistema */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-ink-700">
                Razón Social / Nombres *
                {lookupStatus === "found" && <span className="ml-1 text-green-600 font-normal">(auto-completado)</span>}
              </label>
              <input type="text" required value={clientName}
                onChange={e => { setClientName(e.target.value); setFormErrors(p => ({ ...p, clientName: "" })); }}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lilac-500 focus:outline-none ${lookupStatus === "found" ? "border-green-300 bg-green-50/30" : formErrors.clientName ? "border-red-400" : "border-lilac-200"}`}
                placeholder="Nombre completo o razón social" />
              {formErrors.clientName && <p className="text-xs text-red-500">{formErrors.clientName}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Correo Electrónico *</label>
              <input type="email" required value={clientEmail}
                onChange={e => { setClientEmail(e.target.value); setFormErrors(p => ({ ...p, clientEmail: "" })); }}
                onBlur={e => { const err = validateEmail(e.target.value); if (err) setFormErrors(p => ({ ...p, clientEmail: err })); }}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lilac-500 focus:outline-none ${formErrors.clientEmail ? "border-red-400" : "border-lilac-200"}`}
                placeholder="correo@ejemplo.com" />
              {formErrors.clientEmail && <p className="text-xs text-red-500">{formErrors.clientEmail}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Teléfono</label>
              <input type="text" value={clientPhone}
                onChange={e => { setClientPhone(e.target.value); setFormErrors(p => ({ ...p, clientPhone: "" })); }}
                onBlur={e => { const err = validateTelefono(e.target.value, true); if (err) setFormErrors(p => ({ ...p, clientPhone: err })); }}
                className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lilac-500 focus:outline-none ${formErrors.clientPhone ? "border-red-400" : "border-lilac-200"}`}
                placeholder="0999999999" />
              {formErrors.clientPhone && <p className="text-xs text-red-500">{formErrors.clientPhone}</p>}
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-ink-700">Dirección</label>
              <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)}
                className="w-full bg-white border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-lilac-500 focus:outline-none"
                placeholder="Av. Principal y Secundaria" />
            </div>
          </div>
        </div>

        {/* ── Método de Pago ──────────────────────────────── */}
        <div className={`border rounded-2xl shadow-sm p-4 sm:p-5 transition-colors ${
          paymentMethod === "transferencia"
            ? "bg-blue-50/30 border-blue-200"
            : paymentMethod === "tarjeta_credito"
            ? "bg-purple-50/30 border-purple-200"
            : "bg-green-50/20 border-green-200"
        }`}>
          <h3 className="font-semibold text-sm text-ink-700 flex items-center gap-2 mb-3 border-b border-lilac-100/60 pb-2">
            <span className="text-lilac-600">💳</span>
            Forma de Pago
          </h3>

          {/* Selector de método */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-ink-700 block mb-1">Método *</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(m => {
                const isSelected = paymentMethod === m.value;
                let activeClass = "bg-green-600 text-white border-green-600 shadow-sm";
                let icon = "💵 ";

                if (m.value === "transferencia") {
                  activeClass = "bg-blue-600 text-white border-blue-600 shadow-sm";
                  icon = "🏦 ";
                } else if (m.value === "tarjeta_credito") {
                  activeClass = "bg-purple-600 text-white border-purple-600 shadow-sm";
                  icon = "💳 ";
                }

                return (
                  <button key={m.value} type="button"
                    onClick={() => { setPaymentMethod(m.value); setBankAccountId(""); setPaymentReference(""); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
                      isSelected ? activeClass : "bg-white text-ink-700 border-lilac-200 hover:border-lilac-400"
                    }`}>
                    <span>{icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Efectivo: flujo inmediato */}
          {!requiresBankConfirmation && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                <strong>Pago en efectivo</strong> — Descuento al contado del {discountRate}% aplicado automáticamente. La factura se emite y queda cobrada inmediatamente.
              </p>
            </div>
          )}

          {/* Transferencia */}
          {paymentMethod === "transferencia" && (
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700">Cuenta *</label>
                  <select value={bankAccountId}
                    onChange={e => { setBankAccountId(e.target.value); setFormErrors(p => ({ ...p, bankAccountId: "" })); }}
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none ${formErrors.bankAccountId ? "border-red-400" : "border-blue-300"}`}>
                    <option value="">— Cuenta destino —</option>
                    {bankAccounts.filter(b => b.account_type !== "caja").map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name}{b.account_number ? ` · ${b.account_number}` : ""}{b.notes ? ` (${b.notes})` : ""}
                      </option>
                    ))}
                  </select>
                  {formErrors.bankAccountId && <p className="text-xs text-red-500">{formErrors.bankAccountId}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700">N° Referencia</label>
                  <input type="text" value={paymentReference}
                    onChange={e => { setPaymentReference(e.target.value); setFormErrors(p => ({ ...p, paymentReference: "" })); }}
                    placeholder="TRF-001234 (Opcional)"
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none font-mono ${formErrors.paymentReference ? "border-red-400" : "border-blue-300"}`} />
                  {formErrors.paymentReference && <p className="text-xs text-red-500">{formErrors.paymentReference}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                    <Paperclip size={11} /> Comprobante
                  </label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => setComprobanteFile(e.target.files?.[0] ?? null)} />
                    <button type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs transition-colors ${comprobanteFile ? "border-green-400 bg-green-50 text-green-700" : "border-blue-300 bg-white text-ink-500 hover:bg-blue-50"}`}>
                      <Paperclip size={12} />
                      {comprobanteFile ? comprobanteFile.name.slice(0, 18) + "…" : "Adjuntar archivo"}
                    </button>
                    {comprobanteFile && (
                      <button type="button" onClick={() => { setComprobanteFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-ink-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tarjeta */}
          {paymentMethod === "tarjeta_credito" && (
            <div className="space-y-3 mt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-ink-700">Tipo de Tarjeta *</label>
                  <input type="text" value={cardType} list="tarjetas-ec"
                    onChange={e => { setCardType(e.target.value); setFormErrors(p => ({ ...p, cardType: "" })); }}
                    placeholder="Ej. Visa, Mastercard..."
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none ${formErrors.cardType ? "border-red-400" : "border-purple-300"}`} />
                  <datalist id="tarjetas-ec">
                    <option value="Visa" />
                    <option value="Mastercard" />
                    <option value="American Express" />
                    <option value="Diners Club" />
                    <option value="Discover" />
                    <option value="Alia" />
                    <option value="PacifiCard" />
                  </datalist>
                  {formErrors.cardType && <p className="text-xs text-red-500">{formErrors.cardType}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700">N° Lote *</label>
                  <input type="text" value={cardLote}
                    onChange={e => { setCardLote(e.target.value); setFormErrors(p => ({ ...p, cardLote: "" })); }}
                    placeholder="0012"
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none font-mono ${formErrors.cardLote ? "border-red-400" : "border-purple-300"}`} />
                  {formErrors.cardLote && <p className="text-xs text-red-500">{formErrors.cardLote}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700">N° Baucher *</label>
                  <input type="text" value={cardVoucher}
                    onChange={e => { setCardVoucher(e.target.value); setFormErrors(p => ({ ...p, cardVoucher: "" })); }}
                    placeholder="000123"
                    className={`w-full bg-white border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 focus:outline-none font-mono ${formErrors.cardVoucher ? "border-red-400" : "border-purple-300"}`} />
                  {formErrors.cardVoucher && <p className="text-xs text-red-500">{formErrors.cardVoucher}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                    <Paperclip size={11} /> Comprobante
                  </label>
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf"
                      className="hidden"
                      onChange={e => setComprobanteFile(e.target.files?.[0] ?? null)} />
                    <button type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs transition-colors ${comprobanteFile ? "border-green-400 bg-green-50 text-green-700" : "border-amber-300 bg-white text-ink-500 hover:bg-amber-50"}`}>
                      <Paperclip size={12} />
                      {comprobanteFile ? comprobanteFile.name.slice(0, 18) + "…" : "Adjuntar archivo"}
                    </button>
                    {comprobanteFile && (
                      <button type="button" onClick={() => { setComprobanteFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-ink-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Ítems ───────────────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-lilac-100 bg-lilac-50/30">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm text-ink-700 flex items-center gap-2">
                <FileText size={15} className="text-lilac-600" />
                Servicios / Productos
              </h3>
              <div className="flex gap-2">
                {services.length > 0 && (
                  <button type="button" onClick={() => setShowCatalog(!showCatalog)}
                    className="flex items-center gap-1 text-xs bg-lilac-600 hover:bg-lilac-700 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition-colors">
                    <BookOpen size={13} /> Catálogo
                    <ChevronDown size={11} className={`transition-transform ${showCatalog ? "rotate-180" : ""}`} />
                  </button>
                )}
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 text-xs bg-white border border-lilac-200 px-3 py-1.5 rounded-lg hover:bg-lilac-50 text-lilac-700 font-medium shadow-sm transition-colors">
                  <Plus size={13} /> Manual
                </button>
              </div>
            </div>

            {/* Panel catálogo */}
            {showCatalog && (
              <div className="mt-3 border border-lilac-200 rounded-xl bg-white overflow-hidden shadow-sm">
                <div className="max-h-64 overflow-y-auto divide-y divide-lilac-50">
                  {Object.entries(
                    services.reduce((acc: Record<string, Service[]>, s) => {
                      if (!acc[s.category]) acc[s.category] = [];
                      acc[s.category].push(s);
                      return acc;
                    }, {})
                  ).map(([cat, catServices]) => (
                    <div key={cat}>
                      <div className="px-3 py-1.5 bg-lilac-50">
                        <span className="text-[10px] font-bold text-lilac-600 uppercase tracking-wide">{cat}</span>
                      </div>
                      {catServices.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addFromCatalog(s)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-lilac-50 transition-colors text-left"
                        >
                          <div>
                            <p className="text-sm font-medium text-ink-800">{s.name}</p>
                            {s.description && <p className="text-xs text-ink-400">{s.description}</p>}
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-xs font-bold text-lilac-700">PVP: ${Number(s.price).toFixed(2)}</p>
                            {discountRate > 0 && (
                              <p className="text-[11px] font-semibold text-green-700">
                                Efectivo: ${(Number(s.price) * (1 - discountRate / 100)).toFixed(2)}
                              </p>
                            )}
                            <p className="text-[10px] text-ink-400">IVA {s.iva_code === "4" ? "15%" : "0%"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-lilac-50/50 text-ink-500 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2.5">Descripción</th>
                  <th className="px-3 py-2.5 w-16 text-center">Cant.</th>
                  <th className="px-3 py-2.5 w-28">P. Unit.</th>
                  <th className="px-3 py-2.5 w-24">Desc.</th>
                  <th className="px-3 py-2.5 w-16 text-center">%IVA</th>
                  <th className="px-3 py-2.5 w-28 text-right">Total</th>
                  <th className="px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-50">
                {items.map((item) => {
                  const lineTotal = (item.quantity * item.unit_price) - item.discount;
                  return (
                    <tr key={item.id} className="hover:bg-lilac-50/20">
                      <td className="px-3 py-2">
                        <input type="text" required value={item.description}
                          onChange={e => updateItem(item.id, "description", e.target.value)}
                          placeholder="Descripción del servicio"
                          className="w-full bg-transparent border-b border-dashed border-lilac-200 focus:border-lilac-500 focus:outline-none py-1 text-sm" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" required min="1" step="0.01" value={item.quantity}
                          onChange={e => updateItem(item.id, "quantity", Number(e.target.value))}
                          className="w-14 bg-transparent border-b border-dashed border-lilac-200 focus:border-lilac-500 focus:outline-none py-1 text-center font-medium text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                          <input type="number" required min="0" step="0.01" value={item.unit_price}
                            onChange={e => updateItem(item.id, "unit_price", Number(e.target.value))}
                            className="w-full bg-transparent border-b border-dashed border-lilac-200 focus:border-lilac-500 focus:outline-none py-1 pl-4 font-medium text-sm" />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-ink-400 text-xs">$</span>
                          <input type="number" min="0" step="0.01" value={item.discount}
                            onChange={e => updateItem(item.id, "discount", Number(e.target.value))}
                            className="w-full bg-transparent border-b border-dashed border-lilac-200 focus:border-lilac-500 focus:outline-none py-1 pl-4 text-red-600 text-sm" />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, "iva_code", item.iva_code === "4" ? "0" : "4")}
                          className={`w-14 text-xs font-bold py-1 px-2 rounded-lg border transition-colors ${
                            item.iva_code === "4"
                              ? "bg-orange-50 border-orange-200 text-orange-700"
                              : "bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {item.iva_code === "4" ? "15%" : "0%"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-ink-900 text-sm">
                        ${lineTotal > 0 ? lineTotal.toFixed(2) : "0.00"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => removeItem(item.id)}
                          className="text-ink-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="bg-lilac-50/30 px-5 py-4 flex flex-col items-end border-t border-lilac-100">
            <div className="w-60 space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-600">
                <span>Subtotal IVA 15%</span><span>${subtotal15.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>Subtotal IVA 0%</span><span>${subtotal0.toFixed(2)}</span>
              </div>
              {totalDescuento > 0 && (
                <div className="flex justify-between text-ink-600">
                  <span>Descuento {isCashOrTransfer ? `(${discountRate}%)` : ""}</span><span className="text-green-700 font-medium">-${totalDescuento.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-ink-600 border-b border-lilac-200 pb-1.5">
                <span>IVA 15%</span><span>${ivaAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-ink-900 pt-0.5 border-t border-lilac-200 mt-1">
                <span>TOTAL</span><span className="text-lilac-700">${totalFactura.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de errores — solo visible después del primer intento de envío */}
        {hasSubmitted && Object.keys(formErrors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <p className="text-xs font-bold text-red-700 mb-1.5 flex items-center gap-1.5">
              <AlertCircle size={13} /> Completa los siguientes campos antes de emitir:
            </p>
            <ul className="space-y-0.5">
              {Object.values(formErrors).map((err, i) => (
                <li key={i} className="text-xs text-red-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" /> {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(returnUrl || "/erp/facturacion")}
            className="px-5 py-2.5 rounded-xl border border-lilac-200 text-ink-700 font-medium hover:bg-lilac-50 transition-colors text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className={`flex items-center gap-2 text-white px-7 py-2.5 rounded-xl transition-colors font-semibold shadow-md disabled:opacity-70 text-sm ${
              requiresBankConfirmation
                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                : "bg-green-600 hover:bg-green-700 shadow-green-200"
            }`}>
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando…</>
              : requiresBankConfirmation
                ? <><ShieldCheck size={16} /> Pago verificado — Emitir Factura</>
                : <><Send size={16} /> Emitir Factura en Efectivo</>
            }
          </button>
        </div>

      </form>

      {alertModal?.show && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300 animate-in fade-in"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (alertModal.type === "error") {
              setAlertModal(null);
            } else {
              setAlertModal(null);
              router.refresh();
              router.push(returnUrl || "/erp/facturacion");
            }
          }}
        >
          <div 
            className="bg-white border border-lilac-100 rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Icono */}
            <div className="flex items-center justify-center mb-4">
              {alertModal.type === "success" ? (
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <CheckCircle2 size={24} />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <AlertCircle size={24} />
                </div>
              )}
            </div>

            {/* Titulo y Mensaje */}
            <h3 className="text-lg font-bold text-ink-900 mb-2">{alertModal.title}</h3>
            <p className="text-xs text-ink-600 whitespace-pre-wrap leading-relaxed mb-6">{alertModal.message}</p>

            {/* Accion */}
            <div className="w-full">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAlertModal(null);
                  if (alertModal.type === "success") {
                    router.refresh();
                    router.push(returnUrl || "/erp/facturacion");
                  }
                }}
                className={`w-full py-2.5 rounded-xl text-xs font-semibold text-white transition shadow-md ${
                  alertModal.type === "success" 
                    ? "bg-green-600 hover:bg-green-700 shadow-green-200" 
                    : "bg-red-600 hover:bg-red-700 shadow-red-200"
                }`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
