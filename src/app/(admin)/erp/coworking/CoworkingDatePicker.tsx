"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

interface Props {
  targetDate: string;
  resource: string;
  status: string;
}

export default function CoworkingDatePicker({
  targetDate,
  resource,
  status,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1.5 bg-white border border-lilac-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
      <Calendar size={13} className="text-lilac-600 shrink-0" />
      <span className="text-xs text-ink-500 font-medium whitespace-nowrap hidden sm:inline">
        Fecha:
      </span>
      <input
        type="date"
        className="text-xs font-semibold text-ink-800 bg-transparent focus:outline-none cursor-pointer font-mono"
        value={targetDate}
        onChange={(e) => {
          if (e.target.value) {
            router.push(
              `/erp/coworking?date=${e.target.value}&resource=${resource}&status=${status}&view=day`
            );
          }
        }}
      />
    </div>
  );
}
