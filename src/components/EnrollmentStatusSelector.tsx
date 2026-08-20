"use client";

interface Props {
  enrollmentId: string;
  studentId: string;
  initialStatus: string;
  isMatriculado?: boolean;
  action: (formData: FormData) => Promise<any>;
}

export default function EnrollmentStatusSelector({
  enrollmentId,
  studentId,
  initialStatus,
  isMatriculado = false,
  action,
}: Props) {
  // 1. Si el alumno está en estado RETIRADO:
  //    Permite volver al estado que estuvo antes (Matriculado o Inscrito)
  if (initialStatus === "dropped") {
    return (
      <form action={action} className="flex items-center gap-1.5">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <select
          name="status"
          defaultValue="dropped"
          onChange={(e) => e.target.form?.requestSubmit()}
          className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500 font-medium cursor-pointer"
        >
          <option value="dropped">Retirado</option>
          <option value="enrolled">{isMatriculado ? "Matriculado" : "Inscrito"}</option>
        </select>
      </form>
    );
  }

  // 2. Si está en estado INSCRITO (Pendiente de Pago / No matriculado todavía):
  //    Solo se permite cambiar a Retirado
  if (!isMatriculado && initialStatus !== "completed") {
    return (
      <form action={action} className="flex items-center gap-1.5">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <select
          name="status"
          defaultValue="enrolled"
          onChange={(e) => e.target.form?.requestSubmit()}
          className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500 font-medium cursor-pointer"
        >
          <option value="enrolled">Inscrito</option>
          <option value="dropped">Retirado</option>
        </select>
      </form>
    );
  }

  // 3. Si está en estado MATRICULADO o FINALIZADO:
  //    Permite cambiar a Finalizado y Retirado
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <select
        name="status"
        defaultValue={initialStatus === "completed" ? "completed" : "enrolled"}
        onChange={(e) => e.target.form?.requestSubmit()}
        className="text-xs px-2.5 py-1 bg-white border border-lilac-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500 font-medium cursor-pointer"
      >
        <option value="enrolled">Matriculado</option>
        <option value="completed">Finalizado</option>
        <option value="dropped">Retirado</option>
      </select>
    </form>
  );
}
