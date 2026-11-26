"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEnrollmentStatusAction } from "@/app/(admin)/erp/cursos/actions";

interface Props {
  enrollmentId: string;
  studentId: string;
  courseId?: string;
  initialStatus: string;
  isMatriculado?: boolean;
  /** Prop opcional mantenido por compatibilidad; si no se pasa, usa updateEnrollmentStatusAction */
  action?: (formData: FormData) => Promise<any>;
}

/**
 * Selector de estado de matrícula (Inscrito / Matriculado / Finalizado / Retirado).
 * Valida en servidor que no existan módulos facturados antes de retirar,
 * y que exista al menos un pago en módulo antes de pasar a Matriculado.
 */
export default function EnrollmentStatusSelector({
  enrollmentId,
  studentId,
  courseId,
  initialStatus,
  isMatriculado = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentSelectValue =
    initialStatus === "dropped"
      ? "dropped"
      : initialStatus === "completed"
      ? "completed"
      : isMatriculado
      ? "matriculado"
      : "inscrito";

  const [value, setValue] = useState(currentSelectValue);

  const handleChange = (nextValue: string) => {
    const previousValue = value;
    setValue(nextValue);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updateEnrollmentStatusAction(
        enrollmentId,
        nextValue,
        courseId,
        studentId
      );
      if (!res.success) {
        setValue(previousValue);
        setErrorMsg(res.error || "No se pudo actualizar el estado.");
        return;
      }
      router.refresh();
    });
  };

  const renderOptions = () => {
    if (initialStatus === "dropped") {
      return (
        <>
          <option value="dropped">Retirado</option>
          <option value="matriculado">Matriculado</option>
          {!isMatriculado && <option value="inscrito">Inscrito</option>}
        </>
      );
    }

    if (!isMatriculado && initialStatus !== "completed") {
      return (
        <>
          <option value="inscrito">Inscrito</option>
          <option value="matriculado">Matriculado</option>
          <option value="dropped">Retirado</option>
        </>
      );
    }

    return (
      <>
        <option value="matriculado">Matriculado</option>
        <option value="completed">Finalizado</option>
        <option value="dropped">Retirado</option>
      </>
    );
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500 font-medium cursor-pointer disabled:opacity-50"
      >
        {renderOptions()}
      </select>
      {errorMsg && (
        <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md max-w-[240px] text-right leading-tight">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
