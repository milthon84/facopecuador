"use client";

import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";

interface Props {
  patientId: string;
  appointmentId: string;
}

export default function BillingPendingButton({ patientId, appointmentId }: Props) {
  const router = useRouter();

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/erp/facturacion/nueva?patient_id=${patientId}&appointment_id=${appointmentId}`);
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all shadow-sm"
      title="Registrar factura para esta cita"
    >
      <Receipt size={12} className="text-amber-600" />
      <span>Pendiente Facturación</span>
    </button>
  );
}
