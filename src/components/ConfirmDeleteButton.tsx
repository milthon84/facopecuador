"use client";

import { Trash2 } from "lucide-react";

interface Props {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  idName?: string;
  idValue: string;
  extraFields?: Record<string, string>;
}

export default function ConfirmDeleteButton({
  action,
  confirmMessage,
  idName = "id",
  idValue,
  extraFields = {},
}: Props) {
  return (
    <form action={action}>
      <input type="hidden" name={idName} value={idValue} />
      {Object.entries(extraFields).map(([name, val]) => (
        <input key={name} type="hidden" name={name} value={val} />
      ))}
      <button
        type="submit"
        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
        onClick={(e) => {
          if (!confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <Trash2 size={15} />
      </button>
    </form>
  );
}
