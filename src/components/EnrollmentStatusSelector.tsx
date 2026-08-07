"use client";

interface Props {
  enrollmentId: string;
  studentId: string;
  initialStatus: string;
  action: (formData: FormData) => Promise<any>;
}

export default function EnrollmentStatusSelector({
  enrollmentId,
  studentId,
  initialStatus,
  action,
}: Props) {
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <select
        name="status"
        defaultValue={initialStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500"
      >
        <option value="pre_enrolled">Pre-Inscrito (Pago Pendiente)</option>
        <option value="enrolled">Matriculado</option>
        <option value="completed">Finalizado</option>
        <option value="dropped">Retirado</option>
      </select>
    </form>
  );
}
