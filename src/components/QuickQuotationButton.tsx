"use client";

import { useState } from "react";
import { Plus, Calculator } from "lucide-react";
import NuevaCotizacionModal from "@/components/NuevaCotizacionModal";

interface Props {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
}

export default function QuickQuotationButton({
  patientId,
  patientName,
  patientPhone,
  patientEmail,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-lilac-800 to-gold-600 hover:from-lilac-900 hover:to-gold-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus size={14} /> Nueva Cotización
      </button>

      {isOpen && (
        <NuevaCotizacionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          patientId={patientId}
          patientName={patientName}
          patientPhone={patientPhone}
          patientEmail={patientEmail}
        />
      )}
    </>
  );
}
