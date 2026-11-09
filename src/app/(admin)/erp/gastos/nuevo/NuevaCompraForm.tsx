"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import {
  Save,
  Stethoscope,
  GraduationCap,
  Building2,
  Paperclip,
  Eye,
  X,
  ExternalLink,
  Loader2,
  Calendar,
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Search,
  CheckCircle2,
  Receipt,
  FileCheck2,
  Info,
  CreditCard,
  Key,
} from "lucide-react";
import { resolveExpenseArea, ExpenseArea, resolveReceiptUrl, cleanDocNumberOnly } from "@/lib/expense-areas";
import { proxyStorageUrl } from "@/lib/storage-proxy";
import {
  FacturaRecibida,
  ExpenseItemRow,
  calculateItemRow,
  calculateExpenseTotals,
  EXPENSE_ITEM_CATEGORIES,
  EXPENSE_CATEGORY_DETAILS,
  normalizeCategoryName,
} from "@/lib/expense-types";
import {
  ExpenseAccountsCatalog,
  ExpenseGroup,
  ExpenseMovementAccount,
  FALLBACK_EXPENSE_GROUPS,
  FALLBACK_EXPENSE_MOVEMENTS,
} from "@/lib/expense-accounts";
import { lookupSupplierAccountAction, recordExpensePaymentAction } from "../actions";

type Account = {
  id: string;
  bank_name: string;
  account_number: string | null;
  account_type: string;
  notes?: string | null;
};

type SupplierItem = { ruc: string; name: string };

interface Props {
  today: string;
  bankAccounts: Account[];
  cajaAccounts: Account[];
  knownSuppliersList?: SupplierItem[];
  pendingFacturas?: FacturaRecibida[];
  initialFacturaClave?: string | null;
  initialData?: any;
  initialItems?: ExpenseItemRow[];
  accountsCatalog?: ExpenseAccountsCatalog;
  saveExpense: (formData: FormData) => Promise<void | { success?: boolean; error?: string; url?: string }>;
}

export default function NuevaCompraForm({
  today,
  bankAccounts,
  cajaAccounts,
  knownSuppliersList = [],
  pendingFacturas = [],
  initialFacturaClave = null,
  initialData,
  initialItems = [],
  accountsCatalog,
  saveExpense,
}: Props) {
  const isEditing = Boolean(initialData?.id);
  const [area, setArea] = useState<ExpenseArea>(resolveExpenseArea(initialData || {}));
  const [method, setMethod] = useState(initialData?.payment_method || "efectivo");
  const [docType, setDocType] = useState<"factura" | "nota_venta" | "sin_documento">(
    initialData
      ? initialData.document_number
        ? "factura"
        : "sin_documento"
      : "factura"
  );

  const [supplierRuc, setSupplierRuc] = useState(initialData?.supplier_ruc || "");
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [docNumber, setDocNumber] = useState(() => cleanDocNumberOnly(initialData?.document_number || ""));
  const [expenseDate, setExpenseDate] = useState(initialData?.expense_date || today);
  const [authNumber, setAuthNumber] = useState(initialData?.authorization_number || "");
  const [selectedFacturaClave, setSelectedFacturaClave] = useState<string | null>(
    initialFacturaClave || initialData?.factura_recibida_clave_acceso || null
  );

  // Selector y buscador de facturas recibidas
  const [facturaSearch, setFacturaSearch] = useState("");
  const [facturaDropdownOpen, setFacturaDropdownOpen] = useState(false);

  // Catálogo contable dinámico
  const accountsByGroup = accountsCatalog?.accountsByGroup || {};
  const allMovements = accountsCatalog?.allMovements || FALLBACK_EXPENSE_MOVEMENTS;
  const rawGroups = accountsCatalog?.groups || FALLBACK_EXPENSE_GROUPS;

  // Solo mostrar grupos que tengan al menos una cuenta de movimiento
  const groups = rawGroups.filter(
    (g) => accountsByGroup[g.code] && accountsByGroup[g.code].length > 0
  );

  const defaultGroupCode = area === "clinica" ? "5.1.01" : "5.2.05";
  const defaultAccountCode = area === "clinica" ? "5.1.01.01" : "5.2.05.01";

  function getDefaultMovementForGroup(groupCode: string): ExpenseMovementAccount | undefined {
    const list = accountsByGroup[groupCode];
    if (list && list.length > 0) return list[0];
    return allMovements.find((m) => m.group_code === groupCode);
  }

  // Memoria del proveedor (cuenta contable habitual)
  const [detectedSupplierAccount, setDetectedSupplierAccount] = useState<{
    group_code?: string;
    group_name?: string;
    account_code?: string;
    account_name?: string;
    isNew?: boolean;
  } | null>(null);
  const [isLookingUpSupplier, setIsLookingUpSupplier] = useState(false);

  // Líneas de detalle del gasto (Cabecera y Detalle)
  const [items, setItems] = useState<ExpenseItemRow[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((it) => {
        const accCode = it.account_code || defaultAccountCode;
        const mov = allMovements.find((m) => m.code === accCode);
        const grpCode = it.group_code || mov?.group_code || defaultGroupCode;
        const grp = groups.find((g) => g.code === grpCode);
        return {
          ...it,
          group_code: grpCode,
          group_name: it.group_name || grp?.name || "",
          account_code: accCode,
          account_name: it.account_name || mov?.name || "",
          category: it.category || mov?.name || "Gasto Operativo",
        };
      });
    }
    if (initialData) {
      const sub0 = Number(initialData.subtotal_0) || 0;
      const sub15 = Number(initialData.subtotal_15) || 0;
      const accCode = initialData.account_code || defaultAccountCode;
      const mov = allMovements.find((m) => m.code === accCode);
      const grpCode = initialData.group_code || mov?.group_code || defaultGroupCode;
      const grp = groups.find((g) => g.code === grpCode);
      const result: ExpenseItemRow[] = [];
      if (sub15 > 0) {
        result.push({
          id: "init-15",
          description: initialData.description || "Bienes / Servicios gravados IVA",
          group_code: grpCode,
          group_name: grp?.name || "",
          account_code: accCode,
          account_name: mov?.name || "",
          category: mov?.name || "Gasto Operativo",
          quantity: 1,
          unit_price: sub15,
          iva_rate: 15,
        });
      }
      if (sub0 > 0) {
        result.push({
          id: "init-0",
          description: initialData.description || "Bienes / Servicios tarifa 0%",
          group_code: grpCode,
          group_name: grp?.name || "",
          account_code: accCode,
          account_name: mov?.name || "",
          category: mov?.name || "Gasto Operativo",
          quantity: 1,
          unit_price: sub0,
          iva_rate: 0,
        });
      }
      if (result.length > 0) return result;
    }
    return [
      {
        id: "item-1",
        description: "",
        group_code: defaultGroupCode,
        group_name: groups.find((g) => g.code === defaultGroupCode)?.name || "",
        account_code: defaultAccountCode,
        account_name: allMovements.find((m) => m.code === defaultAccountCode)?.name || "",
        category: "Insumos Clínicos",
        quantity: 1,
        unit_price: "",
        iva_rate: 15,
      },
    ];
  });

  // Totales calculados en tiempo real desde el detalle
  const totals = calculateExpenseTotals(items);

  // IVA editable / personalizado (para coincidir centavos con comprobante SRI o físico)
  const [customIva, setCustomIva] = useState<number | null>(() => {
    if (initialData?.iva_amount !== undefined && initialData?.iva_amount !== null) {
      const initIva = Number(initialData.iva_amount);
      return !isNaN(initIva) ? initIva : null;
    }
    return null;
  });

  const effectiveIva = docType === "factura"
    ? (customIva !== null ? customIva : totals.ivaAmount)
    : 0;

  const effectiveTotal = Math.round((totals.subtotal0 + totals.subtotal15 + effectiveIva) * 100) / 100;

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Respaldo digital (solo botón y chip)
  const initialReceipt = resolveReceiptUrl(initialData || {});
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(initialReceipt);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-cargar factura recibida si viene por parámetro inicial
  useEffect(() => {
    if (initialFacturaClave && pendingFacturas.length > 0 && !isEditing) {
      const match = pendingFacturas.find((f) => f.clave_acceso === initialFacturaClave);
      if (match) {
        aplicarFacturaRecibida(match);
      }
    }
  }, [initialFacturaClave, pendingFacturas, isEditing]);

  async function lookupSupplier(ruc: string) {
    const clean = ruc.trim();
    if (!clean || clean.length < 10) return;
    setIsLookingUpSupplier(true);
    try {
      const res = await lookupSupplierAccountAction(clean);
      if (res?.success && res.data?.default_account_code) {
        const accCode = res.data.default_account_code;
        const mov = allMovements.find((m) => m.code === accCode);
        const grpCode = res.data.default_group_code || mov?.group_code || defaultGroupCode;
        const grp = groups.find((g) => g.code === grpCode);
        const accName = mov?.name || res.data.default_account_name || "";

        setDetectedSupplierAccount({
          group_code: grpCode,
          group_name: grp?.name,
          account_code: accCode,
          account_name: accName,
          isNew: false,
        });

        // Auto-aplicar la cuenta habitual a todas las filas
        setItems((prev) =>
          prev.map((it) => ({
            ...it,
            group_code: grpCode,
            group_name: grp?.name || "",
            account_code: accCode,
            account_name: accName,
          }))
        );
      } else {
        setDetectedSupplierAccount({ isNew: true });
      }
    } catch (err) {
      console.warn("Error buscando cuenta habitual de proveedor:", err);
    } finally {
      setIsLookingUpSupplier(false);
    }
  }

  function aplicarFacturaRecibida(factura: FacturaRecibida) {
    setSelectedFacturaClave(factura.clave_acceso);
    const ruc = factura.ruc_emisor || "";
    setSupplierRuc(ruc);
    setSupplierName(factura.razon_social || "");
    const cleanNum = cleanDocNumberOnly(factura.numero_comprobante || "");
    setDocNumber(cleanNum);
    if (factura.fecha_emision) setExpenseDate(factura.fecha_emision);
    setAuthNumber(factura.clave_acceso || "");
    setDocType("factura");

    if (ruc && ruc.length >= 10) {
      lookupSupplier(ruc);
    }

    // Construir filas de detalle con base en los montos de la factura
    const subtotal = Number(factura.subtotal) || 0;
    const iva = Number(factura.iva) || 0;
    const total = Number(factura.total) || 0;

    // Fijar IVA exacto de la factura SRI (evita discrepancias de centavos por redondeos)
    if (iva > 0) {
      setCustomIva(Math.round(iva * 100) / 100);
    } else {
      setCustomIva(0);
    }

    const effectiveGrp = detectedSupplierAccount?.group_code || defaultGroupCode;
    const grp = groups.find(g => g.code === effectiveGrp);
    const effectiveAcc = detectedSupplierAccount?.account_code || defaultAccountCode;
    const mov = allMovements.find(m => m.code === effectiveAcc);

    const newRows: ExpenseItemRow[] = [];
    if (subtotal > 0) {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social ? `${factura.razon_social} - Fac #${cleanNum}` : "Compra según factura electrónica",
        group_code: effectiveGrp,
        group_name: grp?.name || "",
        account_code: effectiveAcc,
        account_name: mov?.name || "",
        category: mov?.name || "Gasto Operativo",
        quantity: 1,
        unit_price: subtotal,
        iva_rate: iva > 0 ? 15 : 0,
      });
    } else if (total > 0) {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social ? `${factura.razon_social} - Fac #${cleanNum}` : "Compra según factura electrónica",
        group_code: effectiveGrp,
        group_name: grp?.name || "",
        account_code: effectiveAcc,
        account_name: mov?.name || "",
        category: mov?.name || "Gasto Operativo",
        quantity: 1,
        unit_price: total,
        iva_rate: 0,
      });
    } else {
      newRows.push({
        id: `fac-${Date.now()}-1`,
        description: factura.razon_social || "Factura electrónica SRI",
        group_code: effectiveGrp,
        group_name: grp?.name || "",
        account_code: effectiveAcc,
        account_name: mov?.name || "",
        category: mov?.name || "Gasto Operativo",
        quantity: 1,
        unit_price: "",
        iva_rate: 15,
      });
    }
    setItems(newRows);
    setFacturaDropdownOpen(false);
  }

  function desvincularFactura() {
    setSelectedFacturaClave(null);
    setCustomIva(null);
  }

  function handleRucChange(val: string) {
    setSupplierRuc(val);
    const cleanRuc = val.trim();
    if (cleanRuc) {
      const match = knownSuppliersList.find((s) => s.ruc === cleanRuc);
      if (match) setSupplierName(match.name);
      if (cleanRuc.length >= 10) {
        lookupSupplier(cleanRuc);
      }
    } else {
      setDetectedSupplierAccount(null);
    }
  }

  // Manejo de filas de detalle
  function addItemRow() {
    const lastItem = items[items.length - 1];
    const lastGrp = lastItem?.group_code || detectedSupplierAccount?.group_code || defaultGroupCode;
    const lastAcc = lastItem?.account_code || detectedSupplierAccount?.account_code || defaultAccountCode;
    const grp = groups.find((g) => g.code === lastGrp);
    const mov = allMovements.find((m) => m.code === lastAcc);

    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "",
        group_code: lastGrp,
        group_name: grp?.name || "",
        account_code: lastAcc,
        account_name: mov?.name || "",
        category: mov?.name || "Gasto Operativo",
        quantity: 1,
        unit_price: "",
        iva_rate: docType === "factura" ? 15 : 0,
      },
    ]);
  }

  function updateItemRow(id: string, field: keyof ExpenseItemRow, val: any) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return { ...row, [field]: val };
      })
    );
  }

  function updateItemGroup(id: string, newGroupCode: string) {
    const grp = groups.find((g) => g.code === newGroupCode);
    const grpMovements = accountsByGroup[newGroupCode] || [];
    const firstAcc = grpMovements[0] || allMovements.find((m) => m.group_code === newGroupCode);
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          group_code: newGroupCode,
          group_name: grp?.name || "",
          account_code: firstAcc?.code || "",
          account_name: firstAcc?.name || "",
          category: firstAcc?.name || "",
        };
      })
    );
  }

  function updateItemAccount(id: string, newAccountCode: string) {
    const mov = allMovements.find((m) => m.code === newAccountCode);
    const grp = mov?.group_code ? groups.find((g) => g.code === mov.group_code) : undefined;
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          account_code: newAccountCode,
          account_name: mov?.name || "",
          category: mov?.name || "",
          group_code: grp ? grp.code : row.group_code,
          group_name: grp ? grp.name : row.group_name,
        };
      })
    );
  }

  function removeItemRow(id: string) {
    if (items.length <= 1) {
      // Dejar una fila limpia en lugar de vaciar
      setItems([
        {
          id: `item-${Date.now()}`,
          description: "",
          group_code: defaultGroupCode,
          group_name: groups.find((g) => g.code === defaultGroupCode)?.name || "",
          account_code: defaultAccountCode,
          account_name: allMovements.find((m) => m.code === defaultAccountCode)?.name || "",
          category: allMovements.find((m) => m.code === defaultAccountCode)?.name || "Gasto Operativo",
          quantity: 1,
          unit_price: "",
          iva_rate: docType === "factura" ? 15 : 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  const needsAccount = method === "efectivo" || method === "transferencia";
  const needsReference = method === "transferencia";

  // Cuentas de Caja Chica para Efectivo
  const efectivoCajaAccounts = cajaAccounts.filter((a) =>
    (a.bank_name || "").toLowerCase().includes("caja chica")
  );
  const finalCajaAccounts = efectivoCajaAccounts.length > 0 ? efectivoCajaAccounts : cajaAccounts;

  const accountOptions = method === "efectivo" ? finalCajaAccounts : bankAccounts;
  const accountLabel = method === "efectivo" ? "Caja Chica de Salida" : "Cuenta Bancaria Emisora";

  // Control de secuencia: Paso 1 (Gasto) -> Paso 2 (Forma de Pago)
  const [savedExpenseId, setSavedExpenseId] = useState<string | null>(initialData?.id || null);
  const [selectedBankId, setSelectedBankId] = useState<string>(() => {
    if (initialData?.bank_account_id) return initialData.bank_account_id;
    if (method === "efectivo" && finalCajaAccounts.length === 1) return finalCajaAccounts[0].id;
    return "";
  });
  const [paymentRef, setPaymentRef] = useState<string>(initialData?.payment_reference || "");
  const [cardType, setCardType] = useState<string>("");
  const [cardLote, setCardLote] = useState<string>("");
  const [cardVoucher, setCardVoucher] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  // Adjunto independiente de Forma de Pago (Transferencia / Voucher)
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentFilePreview, setPaymentFilePreview] = useState<string | null>(null);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);

  function handlePaymentFileSelected(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setPaymentError("Formato de comprobante no compatible. Adjunta un PDF o una foto.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPaymentError("El comprobante de pago no debe superar los 15MB.");
      return;
    }
    setPaymentFile(file);
    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => setPaymentFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPaymentFilePreview(null);
    }
  }

  function removePaymentFile() {
    setPaymentFile(null);
    setPaymentFilePreview(null);
    if (paymentFileInputRef.current) paymentFileInputRef.current.value = "";
  }

  async function handleRecordPayment() {
    const targetExpenseId = savedExpenseId || (isEditing ? initialData?.id : null);
    if (!targetExpenseId) {
      setPaymentError("Primero debes guardar el gasto para poder registrar el pago.");
      return;
    }
    setPaymentError(null);

    if (needsAccount && !selectedBankId) {
      setPaymentError(`Por favor selecciona la ${accountLabel.toLowerCase()}.`);
      return;
    }
    if (needsReference && !paymentRef.trim()) {
      setPaymentError("Por favor ingresa el número de referencia o transferencia.");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const pFormData = new FormData();
      pFormData.set("expense_id", targetExpenseId);
      pFormData.set("payment_method", method);
      pFormData.set("bank_account_id", selectedBankId || "");
      pFormData.set("payment_reference", paymentRef.trim() || "");
      pFormData.set("payment_date", expenseDate);
      if (cardType) pFormData.set("card_type", cardType);
      if (cardLote) pFormData.set("card_lote", cardLote);
      if (cardVoucher) pFormData.set("card_voucher", cardVoucher);
      if (paymentFile) {
        pFormData.set("payment_receipt_file", paymentFile);
      }

      const res = await recordExpensePaymentAction(pFormData);

      if (res?.success) {
        window.location.href = res.url || `/erp/gastos/${targetExpenseId}`;
      } else {
        setPaymentError(res?.error || "Error al registrar el pago.");
        setIsSubmittingPayment(false);
      }
    } catch (err: any) {
      setPaymentError(err?.message || "Error al registrar el pago.");
      setIsSubmittingPayment(false);
    }
  }

  const isSinDocumento = docType === "sin_documento";

  function handleFileSelected(file: File) {
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isImage && !isPdf) {
      setErrorMsg("Formato no compatible. Adjunta un PDF o una foto.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg("El archivo es demasiado pesado (máx 15MB).");
      return;
    }

    setErrorMsg(null);
    setReceiptFile(file);

    if (isImage) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  }

  function removeReceipt() {
    setReceiptFile(null);
    setFilePreview(null);
    setExistingReceiptUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (effectiveTotal <= 0) {
      setErrorMsg("El total del gasto debe ser mayor a cero.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      // Adjuntar los ítems como JSON estructurado
      const validItems = items
        .filter((it) => (Number(it.unit_price) > 0 || it.description.trim() !== ""))
        .map((it, _idx, arr) => {
          const calc = calculateItemRow(it);
          const item15Count = arr.filter((x) => x.iva_rate === 15).length;
          let rowIva = calc.iva;
          if (it.iva_rate === 15 && item15Count === 1 && customIva !== null) {
            rowIva = customIva;
          }
          const rowTotal = Math.round((calc.subtotal + rowIva) * 100) / 100;
          const grpCode = it.group_code || defaultGroupCode;
          const grp = groups.find((g) => g.code === grpCode);
          const accCode = it.account_code || accountsByGroup[grpCode]?.[0]?.code || defaultAccountCode;
          const mov = allMovements.find((m) => m.code === accCode);

          return {
            description: it.description.trim() || "Item de gasto",
            category: mov?.name || it.category || "Gasto Operativo",
            group_code: grpCode,
            group_name: it.group_name || grp?.name || "",
            account_code: accCode,
            account_name: it.account_name || mov?.name || "",
            quantity: calc.qty || 1,
            unit_price: calc.price || 0,
            iva_rate: it.iva_rate,
            subtotal: calc.subtotal,
            iva_amount: rowIva,
            total: rowTotal,
          };
        });

      formData.set("items_json", JSON.stringify(validItems));
      formData.set("account_code", validItems[0]?.account_code || "");
      formData.set("account_name", validItems[0]?.account_name || "");
      formData.set("group_code", validItems[0]?.group_code || "");
      formData.set("group_name", validItems[0]?.group_name || "");
      formData.set("subtotal_0", totals.subtotal0.toString());
      formData.set("subtotal_15", totals.subtotal15.toString());
      formData.set("iva_amount", effectiveIva.toString());
      formData.set("total", effectiveTotal.toString());
      const mainCategory = validItems[0]?.account_name || (area === "clinica" ? "Insumos Dentales" : "Suministros de Oficina");
      formData.set("category", mainCategory);
      if (selectedFacturaClave) {
        formData.set("factura_recibida_clave_acceso", selectedFacturaClave);
      }
      if (authNumber) {
        formData.set("authorization_number", authNumber);
      }
      formData.set("document_number", cleanDocNumberOnly(docNumber));
      formData.set("area", area);
      formData.set("document_type", docType);
      // En registro inicial Paso 1: siempre se causa como pasivo a Cuentas por Pagar (credito)
      formData.set("payment_method", isEditing ? method : "credito");
      if (isEditing) {
        formData.set("bank_account_id", selectedBankId || "");
        formData.set("payment_reference", paymentRef || "");
      }
      formData.set("supplier_name", supplierName.trim());
      formData.set("supplier_ruc", supplierRuc.trim());
      formData.set("expense_date", expenseDate);
      if (isEditing && initialData?.id) {
        formData.set("id", initialData.id);
      }

      const res = (await saveExpense(formData)) as { success?: boolean; error?: string; url?: string; expenseId?: string };
      if (res?.success) {
        if (isEditing) {
          window.location.href = res.url || `/erp/gastos/${initialData.id}`;
        } else if (res.expenseId) {
          setSavedExpenseId(res.expenseId);
          setLoading(false);
          setTimeout(() => {
            paymentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 150);
        } else {
          window.location.href = res.url || "/erp/gastos";
        }
      } else if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setErrorMsg(err.message || "Error al guardar el gasto.");
      setLoading(false);
    }
  }

  const isExistingPdf = Boolean(
    existingReceiptUrl &&
      (existingReceiptUrl.toLowerCase().includes(".pdf") ||
        existingReceiptUrl.toLowerCase().includes("application/pdf"))
  );

  // Filtrado de facturas pendientes para el buscador
  const filteredFacturas = pendingFacturas.filter((f) => {
    if (!facturaSearch.trim()) return true;
    const q = facturaSearch.toLowerCase();
    return (
      (f.razon_social || "").toLowerCase().includes(q) ||
      (f.ruc_emisor || "").toLowerCase().includes(q) ||
      (f.numero_comprobante || "").toLowerCase().includes(q)
    );
  });

  const facturaVinculada = selectedFacturaClave
    ? pendingFacturas.find((f) => f.clave_acceso === selectedFacturaClave)
    : null;

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="bg-white border border-lilac-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        {isEditing && <input type="hidden" name="id" value={initialData.id} />}
        {existingReceiptUrl && <input type="hidden" name="existing_receipt_url" value={existingReceiptUrl} />}
        <input type="hidden" name="category" value={items[0]?.category || initialData?.category || (area === "clinica" ? "Insumo y Material" : "Suministro")} />
        <input type="hidden" name="factura_recibida_clave_acceso" value={selectedFacturaClave || ""} />

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3.5 py-2.5 rounded-xl font-medium flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── PANEL DE VINCULACIÓN CON FACTURAS RECIBIDAS DEL SRI ── */}
        {!isEditing && pendingFacturas.length > 0 && (
          <div className="bg-gradient-to-r from-lilac-50/70 via-indigo-50/40 to-teal-50/50 border border-lilac-200/90 rounded-2xl p-3.5 space-y-2.5 transition">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lilac-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Receipt size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink-900 tracking-tight">
                      Vincular Factura Electrónica Recibida (SRI)
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-lilac-200/70 text-lilac-900">
                      {pendingFacturas.length} pendientes
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-500">
                    Selecciona una factura descargada del SRI para autocompletar cabecera, montos y detalle
                  </p>
                </div>
              </div>

              {facturaVinculada ? (
                <div className="flex items-center gap-2 bg-white/90 border border-teal-300 rounded-xl px-2.5 py-1 text-xs">
                  <CheckCircle2 size={14} className="text-teal-600 shrink-0" />
                  <span className="font-semibold text-teal-950 font-mono text-[11px]">
                    Factura SRI: {cleanDocNumberOnly(facturaVinculada.numero_comprobante) || facturaVinculada.numero_comprobante || "Vinculada"}
                  </span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={desvincularFactura}
                      className="text-ink-400 hover:text-red-600 p-0.5 rounded transition"
                      title="Cambiar selección antes de guardar"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFacturaDropdownOpen(!facturaDropdownOpen)}
                  className="inline-flex items-center gap-1.5 bg-white border border-lilac-300 hover:border-lilac-400 text-lilac-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs hover:bg-lilac-50/50 transition"
                >
                  <Sparkles size={13} className="text-lilac-600" />
                  {facturaDropdownOpen ? "Cerrar catálogo" : "Elegir factura recibida"}
                </button>
              )}
            </div>

            {/* Menú desplegable o buscador de facturas pendientes */}
            {facturaDropdownOpen && (
              <div className="bg-white border border-lilac-200 rounded-xl p-3 shadow-md space-y-2 mt-2 animate-fadeIn">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    type="text"
                    value={facturaSearch}
                    onChange={(e) => setFacturaSearch(e.target.value)}
                    placeholder="Buscar por proveedor, RUC o N° comprobante..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-lilac-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-lilac-50/30 font-medium"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-lilac-50 text-xs">
                  {filteredFacturas.length === 0 ? (
                    <p className="text-ink-400 text-center py-4 text-[11px]">No se encontraron facturas coincidentes.</p>
                  ) : (
                    filteredFacturas.map((fac) => (
                      <div
                        key={fac.clave_acceso}
                        className="py-2 px-2 hover:bg-lilac-50/60 rounded-lg flex items-center justify-between gap-3 transition cursor-pointer"
                        onClick={() => aplicarFacturaRecibida(fac)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink-900 truncate">
                              {fac.razon_social || "Sin Razón Social"}
                            </span>
                            <span className="text-[10px] text-ink-500 font-mono">
                              RUC: {fac.ruc_emisor}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-ink-400 mt-0.5 font-mono">
                            <span>#{fac.numero_comprobante || "N/A"}</span>
                            <span>{fac.fecha_emision}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-ink-950 text-sm block">
                            ${Number(fac.total || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-lilac-600 font-semibold hover:underline">
                            Cargar datos →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 1. Encabezado: Destino del Gasto y Tipo de Comprobante ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-lilac-100">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Destino del Gasto *
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setArea("clinica")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "clinica"
                    ? "border-teal-500 bg-teal-50 text-teal-950 ring-2 ring-teal-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <Stethoscope size={13} className={area === "clinica" ? "text-teal-600" : "text-ink-400"} />
                Clínica Dental
              </button>

              <button
                type="button"
                onClick={() => setArea("cursos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "cursos"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <GraduationCap size={13} className={area === "cursos" ? "text-indigo-600" : "text-ink-400"} />
                Cursos / Educación
              </button>

              <button
                type="button"
                onClick={() => setArea("general")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                  area === "general"
                    ? "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-200 font-bold"
                    : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50"
                }`}
              >
                <Building2 size={13} className={area === "general" ? "text-amber-600" : "text-ink-400"} />
                General / Admin
              </button>
            </div>
            <input type="hidden" name="area" value={area} />
          </div>

          <div className="space-y-1 sm:text-right">
            <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wide block">
              Comprobante
            </span>
            <select
              value={docType}
              onChange={(e) => {
                const val = e.target.value as any;
                setDocType(val);
                if (val !== "factura") {
                  // Si no es factura, setear tarifa iva 0 en ítems
                  setItems((prev) => prev.map((it) => ({ ...it, iva_rate: 0 })));
                }
              }}
              className="border border-lilac-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-800 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400"
            >
              <option value="factura">Factura</option>
              <option value="nota_venta">Nota de Venta</option>
              <option value="sin_documento">Gasto Directo (Sin Doc)</option>
            </select>
            <input type="hidden" name="document_type" value={docType} />
          </div>
        </div>

        {/* ── 2. RUC y Proveedor ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              {isSinDocumento ? "RUC / Cédula" : "RUC / Cédula *"}
            </label>
            <input
              name="supplier_ruc"
              maxLength={13}
              value={supplierRuc}
              onChange={(e) => handleRucChange(e.target.value)}
              list="suppliers-list"
              placeholder="1790483851001"
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
            />
            <datalist id="suppliers-list">
              {knownSuppliersList.map((s) => (
                <option key={s.ruc} value={s.ruc}>
                  {s.name}
                </option>
              ))}
            </datalist>
          </div>

          <div className="sm:col-span-8 space-y-1">
            <label className="text-xs font-semibold text-ink-700">
              {isSinDocumento ? "Concepto / Beneficiario *" : "Proveedor / Beneficiario *"}
            </label>
            <input
              name="supplier_name"
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder={isSinDocumento ? "Ej. Taxi, Caja Chica, Almuerzo" : "Nombre del proveedor o razón social"}
              className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-medium text-ink-900"
            />
          </div>
        </div>

        {/* Indicador de memoria de cuenta habitual del proveedor */}
        {(detectedSupplierAccount || isLookingUpSupplier) && (
          <div className="flex items-center gap-2 text-xs">
            {isLookingUpSupplier ? (
              <div className="flex items-center gap-1.5 text-ink-500 bg-lilac-50/70 border border-lilac-200/80 px-2.5 py-1 rounded-xl">
                <Loader2 size={13} className="animate-spin text-lilac-600" />
                <span>Consultando cuenta contable habitual del proveedor...</span>
              </div>
            ) : detectedSupplierAccount?.isNew ? (
              <div className="flex items-center gap-1.5 text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl">
                <Sparkles size={13} className="text-indigo-600 shrink-0" />
                <span>
                  <strong>Proveedor nuevo:</strong> Selecciona el grupo y cuenta de gasto en el detalle para recordarlo en sus próximas facturas.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-teal-900 bg-teal-50 border border-teal-200/90 px-2.5 py-1 rounded-xl">
                <CheckCircle2 size={13} className="text-teal-600 shrink-0" />
                <span>
                  <strong>Cuenta habitual detectada:</strong>{" "}
                  <span className="bg-teal-100 text-teal-950 px-2 py-0.5 rounded font-semibold text-xs">
                    {detectedSupplierAccount?.account_name}
                  </span>{" "}
                  (preseleccionada en el detalle)
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── 3. N° Documento, Autorización SRI y Fecha ── */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {!isSinDocumento ? (
            <>
              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-ink-700">
                  N° {docType === "factura" ? "Factura" : "Nota de Venta"} (opcional)
                </label>
                <input
                  name="document_number"
                  value={docNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^(?:factura|nota|recibo|comprobante)/i.test(val)) {
                      setDocNumber(cleanDocNumberOnly(val));
                    } else {
                      setDocNumber(val);
                    }
                  }}
                  onBlur={() => setDocNumber((prev) => cleanDocNumberOnly(prev))}
                  placeholder={docType === "factura" ? "001-001-000000001" : "001-001-000001"}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                />
              </div>
              <div className="sm:col-span-5 space-y-1">
                <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                  <Key size={12} className="text-ink-400" /> N° Autorización / Clave SRI (opcional)
                </label>
                <input
                  name="authorization_number"
                  maxLength={49}
                  value={authNumber}
                  onChange={(e) => setAuthNumber(e.target.value)}
                  placeholder="49 dígitos del SRI"
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                />
              </div>
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                  <Calendar size={13} className="text-ink-400" /> Fecha *
                </label>
                <input
                  type="date"
                  name="expense_date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-12 space-y-1">
              <label className="text-xs font-semibold text-ink-700 flex items-center gap-1">
                <Calendar size={13} className="text-ink-400" /> Fecha *
              </label>
              <input
                type="date"
                name="expense_date"
                required
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
              />
              <input type="hidden" name="document_number" value="" />
              <input type="hidden" name="authorization_number" value="" />
            </div>
          )}
        </div>

        {/* ── 4. Descripción General ── */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Descripción / Justificación General</label>
          <input
            name="description"
            defaultValue={initialData?.description || ""}
            placeholder="Resumen o justificación del gasto (opcional)"
            className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900"
          />
        </div>

        {/* ── 5. DETALLE DE ÍTEMS / LÍNEAS DEL GASTO (CABECERA Y DETALLE) ── */}
        <div className="border border-lilac-200 rounded-2xl p-3 sm:p-4 bg-lilac-50/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wide flex items-center gap-1.5">
                <FileCheck2 size={15} className="text-lilac-600" />
                Detalle de Ítems / Bienes o Servicios
              </h3>
              <p className="text-[11px] text-ink-500">
                Desglose de productos o servicios adquiridos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 text-xs font-bold text-lilac-700 hover:text-lilac-900 bg-white border border-lilac-300 hover:bg-lilac-50 px-2.5 py-1 rounded-xl shadow-2xs transition"
              >
                <Plus size={13} /> Agregar Ítem
              </button>
            </div>
          </div>

          {/* Tabla de ítems */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[850px] text-xs table-auto">
              <thead>
                <tr className="border-b border-lilac-200 text-ink-500 text-[11px] font-bold uppercase tracking-wider text-left">
                  <th className="py-2.5 pr-2 font-bold w-[35%] min-w-[240px]">Descripción del Bien / Servicio</th>
                  <th className="py-2.5 px-2 font-bold w-[20%] min-w-[140px]">GRUPO</th>
                  <th className="py-2.5 px-2 font-bold w-[21%] min-w-[150px]">GASTO</th>
                  <th className="py-2.5 px-1.5 text-center font-bold w-[6%] min-w-[50px]">Cant.</th>
                  <th className="py-2.5 px-2 text-right font-bold w-[9%] min-w-[75px]">P. Unitario ($)</th>
                  {docType === "factura" && (
                    <th className="py-2.5 px-1.5 text-center font-bold w-[6%] min-w-[50px]">IVA</th>
                  )}
                  <th className="py-2.5 pl-2 pr-1 text-right font-bold w-[8%] min-w-[70px]">Subtotal</th>
                  <th className="py-2.5 pl-1 text-center font-bold w-[3%] min-w-[28px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-lilac-100">
                {items.map((item, idx) => {
                  const calc = calculateItemRow(item);
                  const grpCode = item.group_code || defaultGroupCode;
                  const movList = accountsByGroup[grpCode] && accountsByGroup[grpCode].length > 0
                    ? accountsByGroup[grpCode]
                    : allMovements;
                  const selectedAcc = item.account_code || movList[0]?.code || "";

                  return (
                    <tr key={item.id} className="group hover:bg-white/60">
                      <td className="py-2 pr-2 align-top">
                        <textarea
                          rows={2}
                          required
                          value={item.description}
                          onChange={(e) => updateItemRow(item.id, "description", e.target.value)}
                          placeholder={`Descripción del bien o servicio ${idx + 1}`}
                          className="w-full border border-lilac-200 rounded-lg px-2.5 py-1.5 bg-white text-ink-900 text-xs focus:ring-1 focus:ring-lilac-400 focus:outline-none resize-none leading-snug"
                        />
                      </td>

                      {/* Selector Grupo Contable */}
                      <td className="py-2 px-2 align-top">
                        <select
                          value={grpCode}
                          onChange={(e) => updateItemGroup(item.id, e.target.value)}
                          title={item.group_name || grpCode}
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-ink-900 text-xs font-semibold focus:ring-1 focus:ring-lilac-400 focus:outline-none truncate"
                        >
                          {groups.map((g) => (
                            <option key={g.code} value={g.code}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Selector Cuenta de Gasto (Movimiento) */}
                      <td className="py-2 px-2 align-top">
                        <select
                          value={selectedAcc}
                          onChange={(e) => updateItemAccount(item.id, e.target.value)}
                          title={item.account_name || selectedAcc}
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-ink-900 text-xs font-medium focus:ring-1 focus:ring-lilac-400 focus:outline-none truncate"
                        >
                          {movList.map((m) => (
                            <option key={m.code} value={m.code}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2 px-1.5 align-top">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          value={item.quantity}
                          onChange={(e) => updateItemRow(item.id, "quantity", e.target.value)}
                          className="w-full border border-lilac-200 rounded-lg px-1.5 py-1.5 bg-white text-center text-ink-900 text-xs font-mono focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={item.unit_price}
                          onChange={(e) => updateItemRow(item.id, "unit_price", e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-lilac-200 rounded-lg px-2 py-1.5 bg-white text-right text-ink-900 text-xs font-mono focus:ring-1 focus:ring-lilac-400 focus:outline-none"
                        />
                      </td>
                      {docType === "factura" && (
                        <td className="py-2 px-1.5 align-top text-center">
                          <select
                            value={item.iva_rate}
                            onChange={(e) => updateItemRow(item.id, "iva_rate", Number(e.target.value))}
                            className="w-full border border-lilac-200 rounded-lg px-1 py-1.5 bg-white text-xs font-semibold text-ink-800 focus:ring-1 focus:ring-lilac-400 focus:outline-none text-center"
                          >
                            <option value={15}>15%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                      )}
                      <td className="py-2 pl-2 pr-1 align-top text-right font-mono font-bold text-ink-900 text-xs pt-3">
                        ${calc.subtotal.toFixed(2)}
                      </td>
                      <td className="py-2 pl-1 align-top text-center pt-2.5">
                        <button
                          type="button"
                          onClick={() => removeItemRow(item.id)}
                          className="text-ink-300 hover:text-red-600 p-1 rounded transition"
                          title="Eliminar fila"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen dinámico del detalle */}
          <div className="pt-2 border-t border-lilac-200/60 flex flex-wrap items-center justify-end gap-x-6 gap-y-1.5 text-xs text-ink-600 font-medium">
            <div>
              <span>Subtotal 0%: </span>
              <strong className="font-mono text-ink-900">${totals.subtotal0.toFixed(2)}</strong>
            </div>
            {docType === "factura" && (
              <>
                <div>
                  <span>Subtotal 15%: </span>
                  <strong className="font-mono text-ink-900">${totals.subtotal15.toFixed(2)}</strong>
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-lilac-200 px-2 py-1 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-ink-700">IVA 15%:</span>
                  <div className="inline-flex items-center">
                    <span className="text-xs font-mono font-bold text-lilac-700 mr-0.5">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={customIva !== null ? customIva : (totals.subtotal15 > 0 ? totals.ivaAmount : 0)}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseFloat(e.target.value);
                        setCustomIva(val !== null && !isNaN(val) ? Math.round(val * 100) / 100 : 0);
                      }}
                      className="w-16 font-mono font-bold text-xs text-lilac-700 bg-transparent text-right focus:outline-none"
                      title="Ajuste de centavos del IVA para coincidir con el comprobante SRI o físico"
                    />
                  </div>
                  {customIva !== null && Math.abs(customIva - totals.ivaAmount) > 0.001 && (
                    <button
                      type="button"
                      onClick={() => setCustomIva(null)}
                      className="text-[10px] text-lilac-600 hover:text-lilac-800 font-bold underline ml-1"
                      title="Restablecer al 15% automático"
                    >
                      Auto
                    </button>
                  )}
                </div>
              </>
            )}
            <div className="text-sm font-bold text-ink-950">
              <span>Total Detalle: </span>
              <span className="font-mono text-lilac-700 font-black">${effectiveTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Input oculto para adjuntar archivo nativo de respaldo del gasto */}
          <input
            ref={fileInputRef}
            type="file"
            name="receipt_file"
            accept=".pdf,image/*"
            onChange={onFileInputChange}
            className="hidden"
          />

          {/* ── Franja de Guardar Gasto (Paso 1: Causación a Cuentas por Pagar) ── */}
          <div className="pt-3 border-t border-lilac-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-lilac-50/40 -mx-4 -mb-4 p-4 rounded-b-2xl">
            <div>
              <span className="text-[11px] font-bold text-ink-600 uppercase tracking-wider block mb-1">
                Respaldo de la Compra / Gasto (Paso 1)
              </span>
              {!receiptFile && !existingReceiptUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-lilac-300 bg-white hover:bg-lilac-50 text-xs font-semibold text-lilac-800 transition shadow-2xs"
                >
                  <Paperclip size={15} className="text-lilac-600" />
                  <span>Adjuntar Factura / Nota / Recibo (PDF o Foto)</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-lilac-200 text-xs shadow-2xs">
                  <Paperclip size={13} className="text-lilac-600 shrink-0" />
                  <span className="font-semibold text-ink-800 truncate max-w-[170px] sm:max-w-[220px]">
                    {receiptFile ? receiptFile.name : "Respaldo digital adjunto"}
                  </span>
                  {(filePreview || existingReceiptUrl) && (
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="text-lilac-700 hover:text-lilac-900 p-1"
                      title="Ver archivo"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Quitar archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
              <div className="text-left sm:text-right">
                <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider block">
                  Total a Causar
                </span>
                <span className="text-2xl font-black text-lilac-700 font-mono">
                  ${effectiveTotal.toFixed(2)}
                </span>
              </div>

              {!savedExpenseId || isEditing ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-lilac-200 transition active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {isEditing ? "Guardar Cambios del Gasto" : "Guardar Gasto (Paso 1)"}
                    </>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3.5 py-2 rounded-xl">
                  <CheckCircle2 size={16} className="text-teal-600" />
                  <span>Gasto guardado en Cuentas por Pagar</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Forma de Pago y Cruce Bancario (Paso 2 Independiente) ── */}
        <div ref={paymentSectionRef} className="scroll-mt-6">
          {!savedExpenseId && !isEditing ? (
            <div className="bg-lilac-50/30 border border-dashed border-lilac-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-left transition">
              <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center shrink-0">
                <CreditCard size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                  Paso 2: Forma de Pago y Cruce Bancario (Independiente)
                </h4>
                <p className="text-xs text-ink-500 mt-0.5">
                  Primero guarda el gasto arriba (Paso 1). Se generará automáticamente el asiento de causación a{" "}
                  <strong className="text-ink-800">Cuentas por Pagar Proveedores (2.1.01.01)</strong>, y luego se habilitará esta sección independiente con su propio adjunto y botón de guardado para cruzar con Bancos o Caja Chica.
                </p>
              </div>
              <div className="shrink-0 text-xs font-semibold text-lilac-600 bg-white border border-lilac-200 px-3 py-1.5 rounded-xl">
                🔒 Se habilita al guardar el gasto
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-lilac-400/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-lilac-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-lilac-600 text-white flex items-center justify-center font-bold text-xs">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wide">
                      Forma de Pago y Cruce Bancario (Paso 2)
                    </h4>
                    <p className="text-[11px] text-teal-800 font-medium">
                      ✓ Causación registrada en Cuentas por Pagar. Selecciona la salida de fondos y adjunta el comprobante de pago:
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {[
                    { value: "efectivo", label: "💵 Efectivo (Caja)" },
                    { value: "transferencia", label: "🏦 Transferencia" },
                    { value: "tarjeta_credito", label: "💳 Tarjeta" },
                  ].map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        method === m.value
                          ? "bg-lilac-600 text-white shadow-xs font-bold"
                          : "bg-lilac-50 text-ink-600 border border-lilac-200 hover:bg-lilac-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {paymentError}
                </div>
              )}

              {needsAccount && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className={needsReference ? "sm:col-span-7 space-y-1" : "sm:col-span-12 space-y-1"}>
                    <label className="text-xs font-semibold text-ink-700">{accountLabel} *</label>
                    <select
                      value={selectedBankId}
                      onChange={(e) => setSelectedBankId(e.target.value)}
                      className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white text-ink-900 font-medium"
                    >
                      <option value="">
                        {method === "efectivo" ? "— Seleccionar Caja Chica —" : "— Seleccionar Cuenta Bancaria —"}
                      </option>
                      {accountOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bank_name}
                          {a.account_number ? ` · ${a.account_number}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {needsReference && (
                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-xs font-semibold text-ink-700">N° Referencia / Voucher *</label>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="Ej. TRF-123456"
                        className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono text-ink-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {method === "tarjeta_credito" && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-ink-700">Tarjeta *</label>
                    <input
                      type="text"
                      value={cardType}
                      onChange={(e) => setCardType(e.target.value)}
                      placeholder="Visa / Master"
                      className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-ink-700">Lote *</label>
                    <input
                      type="text"
                      value={cardLote}
                      onChange={(e) => setCardLote(e.target.value)}
                      placeholder="0012"
                      className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-ink-700">Voucher *</label>
                    <input
                      type="text"
                      value={cardVoucher}
                      onChange={(e) => setCardVoucher(e.target.value)}
                      placeholder="000123"
                      className="w-full border border-lilac-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Input oculto para adjuntar comprobante de pago */}
              <input
                ref={paymentFileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePaymentFileSelected(f);
                }}
                className="hidden"
              />

              {/* Franja de Adjunto de Pago + Botón Registrar Pago Independiente */}
              <div className="pt-3 border-t border-lilac-100 flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
                <div className="w-full sm:w-auto">
                  <span className="text-[11px] font-bold text-ink-600 uppercase tracking-wider block mb-1">
                    Comprobante del Pago (Transferencia / Voucher)
                  </span>
                  {!paymentFile ? (
                    <button
                      type="button"
                      onClick={() => paymentFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-lilac-300 bg-lilac-50/60 hover:bg-lilac-100 text-xs font-semibold text-lilac-800 transition"
                    >
                      <Paperclip size={14} className="text-lilac-600" />
                      <span>Adjuntar Comprobante de Pago (PDF o Foto)</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lilac-50 border border-lilac-200 text-xs">
                      <Paperclip size={13} className="text-lilac-600 shrink-0" />
                      <span className="font-semibold text-ink-800 truncate max-w-[200px]">
                        {paymentFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={removePaymentFile}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Quitar archivo de pago"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const expId = savedExpenseId || (isEditing ? initialData?.id : null);
                      if (expId) {
                        window.location.href = `/erp/gastos/${expId}`;
                      } else {
                        window.location.href = "/erp/gastos";
                      }
                    }}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-lilac-200 bg-white hover:bg-lilac-50 text-ink-600 text-xs font-semibold transition text-center"
                  >
                    Omitir (Dejar pendiente en Ctas. por Pagar) →
                  </button>

                  <button
                    type="button"
                    disabled={isSubmittingPayment}
                    onClick={handleRecordPayment}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold shadow-md shadow-lilac-200 transition active:scale-[0.99] disabled:opacity-50"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Cruzando con Banco...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Registrar y Guardar Pago</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Modal Lightbox para previsualizar el respaldo */}
      {previewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-lilac-100 flex items-center justify-between bg-ink-50/60">
              <span className="text-xs font-bold text-ink-900">Respaldo Digital Adjunto</span>
              <div className="flex items-center gap-2">
                {(existingReceiptUrl || filePreview) && (
                  <a
                    href={filePreview || proxyStorageUrl(existingReceiptUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-lilac-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink size={13} /> Abrir original
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="w-7 h-7 rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 flex items-center justify-center"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-ink-100/40">
              {filePreview ? (
                <img
                  src={filePreview}
                  alt="Vista previa"
                  className="max-h-[65vh] object-contain rounded-lg shadow-xs"
                />
              ) : existingReceiptUrl ? (
                isExistingPdf ? (
                  <div className="text-center py-10 space-y-3">
                    <FileText size={44} className="text-red-600 mx-auto" />
                    <p className="text-xs font-bold text-ink-900">Factura / Respaldo en PDF</p>
                    <a
                      href={proxyStorageUrl(existingReceiptUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-xl font-semibold"
                    >
                      <ExternalLink size={13} /> Ver y Descargar PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={proxyStorageUrl(existingReceiptUrl)}
                    alt="Respaldo actual"
                    className="max-h-[65vh] object-contain rounded-lg shadow-xs"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
