"use client";

import { useRouter } from "next/navigation";

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
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-400">Ir a fecha:</span>
      <input
        type="date"
        className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg text-ink-700 font-mono shadow-2xs focus:outline-none focus:ring-1 focus:ring-lilac-500"
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
