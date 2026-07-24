"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface BillingItem {
  id: string;
  billing_status: "pending" | "invoiced" | "free";
  invoice_id: string | null;
  curso_modulos: {
    id: string;
    number: number;
    name: string;
    cost: number;
  };
  invoices: {
    id: string;
    invoice_number: string;
    sri_status: string;
  } | null;
  student: {
    id: string;
    full_name: string;
    document_number: string;
    email: string;
    phone: string;
  };
  course_name: string;
}

interface Props {
  billingItems: BillingItem[];
  canEdit: boolean;
}

export default function CourseBillingTable({ billingItems, canEdit }: Props) {
  // Guardar IDs de curso_modulo_inscripciones seleccionados
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelect = (id: string, studentId: string) => {
    setErrorMsg(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      
      // Validar si los elementos seleccionados pertenecen al mismo estudiante
      const currentSelected = billingItems.filter((bi) => prev.includes(bi.id));
      const hasDifferentStudent = currentSelected.some((cs) => cs.student.id !== studentId);
      
      if (hasDifferentStudent) {
        setErrorMsg("Solo puedes facturar múltiples módulos si pertenecen al mismo alumno.");
        return prev;
      }
      
      return [...prev, id];
    });
  };

  const handleGroupInvoicing = () => {
    if (selectedIds.length === 0) return "";

    const selectedItems = billingItems.filter((bi) => selectedIds.includes(bi.id));
    const firstItem = selectedItems[0];
    const student = firstItem.student;
    
    // Sumar costos
    const totalCost = selectedItems.reduce((acc, bi) => acc + Number(bi.curso_modulos.cost), 0);
    
    // Construir descripción
    const moduleNumbers = selectedItems.map((bi) => bi.curso_modulos.number).sort((a, b) => a - b).join(", ");
    const description = `Pago Curso: ${firstItem.course_name} - Módulos: ${moduleNumbers}`;

    // Prefill URL params
    const prefName = encodeURIComponent(student.full_name);
    const prefDoc = encodeURIComponent(student.document_number);
    const prefEmail = encodeURIComponent(student.email);
    const prefPhone = encodeURIComponent(student.phone);
    const prefDesc = encodeURIComponent(description);
    const prefPrice = encodeURIComponent(totalCost.toString());
    const prefIds = encodeURIComponent(selectedIds.join(","));

    return `/erp/facturacion/nueva?client_name=${prefName}&client_document=${prefDoc}&client_email=${prefEmail}&client_phone=${prefPhone}&module_enrollment_ids=${prefIds}&item_description=${prefDesc}&item_price=${prefPrice}`;
  };

  const groupInvoiceUrl = handleGroupInvoicing();

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
          <AlertCircle size={14} className="shrink-0" />
          {errorMsg}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="bg-lilac-50 border border-lilac-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <p className="text-xs font-bold text-lilac-700">Módulos seleccionados para facturación agrupada:</p>
            <p className="text-sm font-bold text-ink-950 mt-0.5">
              {selectedIds.length} módulos seleccionados &middot; Alumno: {billingItems.find(bi => bi.id === selectedIds[0])?.student.full_name}
            </p>
          </div>
          {canEdit && (
            <Link
              href={groupInvoiceUrl}
              className="btn-primary text-xs font-bold py-2.5 px-4 flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              <CreditCard size={15} /> Facturar Agrupados (${billingItems.filter(bi => selectedIds.includes(bi.id)).reduce((acc, bi) => acc + Number(bi.curso_modulos.cost), 0).toFixed(2)})
            </Link>
          )}
        </div>
      )}

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-lilac-50/50 text-[10px] font-bold text-ink-500 uppercase tracking-wider border-b border-lilac-100">
              <tr>
                <th className="px-4 py-3 w-10 text-center"></th>
                <th className="text-left px-4 py-3">Alumno / Documento</th>
                <th className="text-left px-4 py-3">Curso</th>
                <th className="text-left px-4 py-3">Módulo</th>
                <th className="text-right px-4 py-3">Costo</th>
                <th className="text-right px-4 py-3">Estado</th>
                <th className="text-right px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {billingItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-ink-500 italic">
                    No se encontraron módulos pendientes o facturas asociadas.
                  </td>
                </tr>
              ) : (
                billingItems.map((bi) => {
                  const isChecked = selectedIds.includes(bi.id);
                  const canSelect = bi.billing_status === "pending" && (selectedIds.length === 0 || billingItems.find(item => item.id === selectedIds[0])?.student.id === bi.student.id);

                  // Prefill individual invoice link parameters
                  const prefName = encodeURIComponent(bi.student.full_name);
                  const prefDoc = encodeURIComponent(bi.student.document_number);
                  const prefEmail = encodeURIComponent(bi.student.email);
                  const prefPhone = encodeURIComponent(bi.student.phone);
                  const prefDesc = encodeURIComponent(`Pago Curso: ${bi.course_name} - Módulo ${bi.curso_modulos.number}: ${bi.curso_modulos.name}`);
                  const prefPrice = encodeURIComponent(bi.curso_modulos.cost.toString());

                  const individualInvoiceLink = `/erp/facturacion/nueva?client_name=${prefName}&client_document=${prefDoc}&client_email=${prefEmail}&client_phone=${prefPhone}&module_enrollment_ids=${bi.id}&item_description=${prefDesc}&item_price=${prefPrice}`;

                  return (
                    <tr key={bi.id} className={`hover:bg-lilac-50/10 ${isChecked ? "bg-lilac-50/20" : ""}`}>
                      <td className="px-4 py-3.5 text-center">
                        {bi.billing_status === "pending" && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canSelect && !isChecked}
                            onChange={() => handleSelect(bi.id, bi.student.id)}
                            className="rounded text-lilac-600 focus:ring-lilac-500 cursor-pointer disabled:opacity-30"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-ink-950">{bi.student.full_name}</div>
                        <div className="text-[10px] text-ink-400 font-mono">{bi.student.document_number}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-ink-700 max-w-[150px] truncate" title={bi.course_name}>
                        {bi.course_name}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-ink-700">
                        Mód. {bi.curso_modulos.number}: {bi.curso_modulos.name}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink-850 text-xs">
                        ${Number(bi.curso_modulos.cost).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {bi.billing_status === "invoiced" && bi.invoices && bi.invoices.sri_status !== "cancelled" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Facturado (#{bi.invoices.invoice_number})
                          </span>
                        ) : bi.billing_status === "free" ? (
                          <span className="text-[10px] font-bold text-ink-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                            Beca
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right shrink-0">
                        {bi.billing_status === "pending" ? (
                          canEdit ? (
                            <Link
                              href={individualInvoiceLink}
                              className="btn-primary text-[10px] font-bold py-1 px-3 shadow-sm hover:scale-[1.02] transition-transform"
                            >
                              Facturar
                            </Link>
                          ) : (
                            <span className="text-[10px] text-ink-400 italic">Sin permisos</span>
                          )
                        ) : bi.invoice_id ? (
                          <Link
                            href={`/erp/facturacion`}
                            className="inline-flex items-center gap-0.5 text-xs text-lilac-600 hover:text-lilac-800 font-semibold"
                          >
                            <FileText size={12} /> SRI
                          </Link>
                        ) : (
                          <span className="text-ink-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
