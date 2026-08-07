export function parseDbError(message?: string | null): string {
  if (!message) return "Ocurrió un error inesperado al procesar la solicitud.";

  if (message.includes("alumnos_document_number_key") || message.includes("document_number")) {
    return "Ya existe un alumno registrado con ese número de cédula, RUC o pasaporte.";
  }
  if (message.includes("alumnos_email_key")) {
    return "Ya existe un alumno registrado con ese correo electrónico.";
  }
  if (message.includes("profesores_document_number_key")) {
    return "Ya existe un docente registrado con ese número de identificación.";
  }
  if (message.includes("profesores_email_key")) {
    return "Ya existe un docente registrado con ese correo electrónico.";
  }
  if (message.includes("curso_inscripciones_course_id_student_id_key") || message.includes("enrolled")) {
    return "El alumno ya se encuentra matriculado en este curso.";
  }
  if (message.includes("cursos_dates_check") || message.includes("end_date") || message.includes("start_date")) {
    return "La fecha de finalización no puede ser anterior a la fecha de inicio.";
  }
  if (message.includes("unique constraint") || message.includes("duplicate key")) {
    return "Ya existe un registro en el sistema con la misma cédula o correo ingresado.";
  }
  if (message.includes("foreign key")) {
    return "No se puede completar la operación porque el registro está vinculado a otros datos en el sistema.";
  }
  if (message.includes("violates check constraint")) {
    return "Los datos ingresados no cumplen con las reglas requeridas del sistema.";
  }

  return message;
}
