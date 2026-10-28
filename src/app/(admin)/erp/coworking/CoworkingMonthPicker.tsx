"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

interface Props {
  activeMonth: string;
  resource: string;
  status: string;
}

export default function CoworkingMonthPicker({
  activeMonth,
  resource,
  status,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5 bg-white border border-lilac-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
      <Calendar size={13} className="text-lilac-600 shrink-0" />
      <span className="text-xs text-ink-500 font-medium whitespace-nowrap hidden sm:inline">
        Mes:
      </span>
      <input
        type="month"
        value={activeMonth}
        onChange={(e) => {
          if (e.target.value) {
            const params = new URLSearchParams();
            params.set("month", e.target.value);
            params.set("view", "month");
            if (resource && resource !== "all") params.set("resource", resource);
            if (status && status !== "all") params.set("status", status);
            router.push(`/erp/coworking?${params.toString()}`);
          }
        }}
        className="text-xs font-semibold text-ink-800 bg-transparent focus:outline-none cursor-pointer font-mono"
      />
    </div>
  );
}
