"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  sriStatus?: string;
  className?: string;
}

export default function InvoiceLinkBadge({
  invoiceId,
  invoiceNumber,
  sriStatus = "authorized",
  className = "",
}: Props) {
  const router = useRouter();

  const isRejected = sriStatus === "rejected" || sriStatus === "error";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/erp/facturacion/${invoiceId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs whitespace-nowrap group ${
        isRejected
          ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300"
          : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-300"
      } ${className}`}
      title={`Ver detalles de la factura N° ${invoiceNumber}`}
    >
      {isRejected ? (
        <XCircle size={13} className="text-red-600 shrink-0" />
      ) : (
        <CheckCircle2 size={13} className="text-green-600 shrink-0" />
      )}
      <span className="group-hover:underline">
        {isRejected ? "Rechazada SRI" : "Facturado"} ({invoiceNumber})
      </span>
    </button>
  );
}
