"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  GraduationCap,
  CalendarDays,
  DollarSign,
  User,
  Phone,
  Mail,
  FileText,
  BookOpen,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

interface Course {
  id: string;
  name: string;
  description: string | null;
  total_cost: number;
  start_date: string;
  end_date: string;
  image_url?: string | null;
}

interface CourseOption {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

interface FormData {
  full_name: string;
  document_number: string;
  phone: string;
  email: string;
  professional_title: string;
  notes: string;
}

type Step = "form" | "submitting" | "done" | "error";

export default function InscripcionCursoPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [otherCourses, setOtherCourses] = useState<CourseOption[]>([]);
  const [step, setStep] = useState<Step>("form");
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    full_name: "",
    document_number: "",
    phone: "",
    email: "",
    professional_title: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Cargar datos del curso
  useEffect(() => {
    fetch(`/api/cursos/publico/${courseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.course) setCourse(data.course);
        else router.push("/");
      })
      .catch(() => router.push("/"))
      .finally(() => setLoadingCourse(false));
  }, [courseId, router]);

  // Cargar lista de cursos activos para permitir cambiar de curso
  useEffect(() => {
    fetch("/api/cursos/publico")
      .then((r) => r.json())
      .then((data) => setOtherCourses(data.courses || []))
      .catch(() => {});
  }, []);

  function handleChangeCourse(newCourseId: string) {
    if (newCourseId && newCourseId !== courseId) {
      router.push(`/inscripcion-curso/${newCourseId}`);
    }
  }

  function handleChange(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};

    if (!form.full_name.trim() || form.full_name.trim().length < 3)
      e.full_name = "Ingresa tu nombre completo (mínimo 3 caracteres)";

    const doc = form.document_number.replace(/\D/g, "");
    if (doc.length < 8 || doc.length > 13)
      e.document_number = "Documento inválido (8–13 dígitos)";

    const phone = form.phone.replace(/\D/g, "");
    if (phone.length < 9 || phone.length > 13)
      e.phone = "Teléfono inválido (9–13 dígitos)";

    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(form.email.trim()))
      e.email = "Correo electrónico inválido";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setStep("submitting");
    setSubmitError(null);

    try {
      const res = await fetch("/api/cursos/inscribirse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          student: {
            full_name: form.full_name.trim(),
            document_number: form.document_number.replace(/\D/g, ""),
            phone: form.phone.replace(/\D/g, ""),
            email: form.email.trim().toLowerCase(),
            professional_title: form.professional_title.trim() || null,
            notes: form.notes.trim() || null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo procesar la inscripción");

      setEnrollmentId(data.enrollment_id);
      setStep("done");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Error inesperado. Intenta nuevamente.";
      setSubmitError(errMsg);
      setStep("error");
    }
  }

  if (loadingCourse) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gold-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <Loader2 size={32} className="animate-spin text-gold-500" />
          <p className="text-sm font-medium">Cargando información del curso…</p>
        </div>
      </main>
    );
  }

  if (step === "done") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gold-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 border border-slate-100 p-8 text-center">
            {/* Icono de éxito */}
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Inscripción recibida!</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Tu solicitud de inscripción al curso <strong className="text-slate-800">{course?.name}</strong> fue
              registrada con éxito. Nuestro equipo se contactará contigo pronto para confirmar los detalles de pago.
            </p>

            {enrollmentId && (
              <div className="bg-slate-50 rounded-xl px-4 py-3 mb-6 text-xs text-slate-500">
                Referencia: <span className="font-mono text-slate-700">{enrollmentId.slice(0, 8).toUpperCase()}</span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-950 text-gold-500 text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gold-50">
      {/* Overlay de procesamiento */}
      {step === "submitting" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-gold-100 border-t-gold-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <GraduationCap size={22} className="text-gold-500" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Procesando inscripción</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Estamos registrando tu solicitud. Por favor no cierres esta ventana.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-5 max-w-3xl mx-auto flex items-center gap-3 border-b border-slate-100/60">
        <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
          <ChevronLeft size={22} />
        </Link>
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-gold-500" />
          <span className="font-semibold text-slate-800 text-sm">Inscripción a Curso</span>
        </div>
      </header>

      <div className="px-4 sm:px-6 max-w-3xl mx-auto py-8 pb-16">

        {/* Selector para cambiar de curso activo */}
        {otherCourses.length > 1 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Curso seleccionado
            </label>
            <select
              value={courseId}
              onChange={(e) => handleChangeCourse(e.target.value)}
              className="w-full sm:w-auto flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-gold-300 focus:border-gold-400 transition-all"
            >
              {otherCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Inicio: {new Date(c.start_date).toLocaleDateString("es-EC", { dateStyle: "medium" })}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tarjeta del curso */}
        {course && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 overflow-hidden mb-8">
            <div className="flex items-start gap-0">
              {/* Imagen del curso */}
              {course.image_url ? (
                <div className="w-32 sm:w-44 flex-shrink-0">
                  <img
                    src={course.image_url}
                    alt={course.name}
                    className="w-full h-full object-cover"
                    style={{ minHeight: "120px", maxHeight: "180px" }}
                  />
                </div>
              ) : (
                <div className="w-32 sm:w-44 flex-shrink-0 bg-gradient-to-br from-slate-100 to-gold-50 flex items-center justify-center" style={{ minHeight: "140px" }}>
                  <BookOpen size={32} className="text-slate-300" />
                </div>
              )}

              {/* Info del curso */}
              <div className="p-5 flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold-50 text-gold-700 text-[10px] font-semibold uppercase tracking-wider mb-2">
                  <GraduationCap size={10} />
                  Inscripciones abiertas
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-3">{course.name}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} className="text-gold-500" />
                    Inicio: {new Date(course.start_date).toLocaleDateString("es-EC", { dateStyle: "medium" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays size={11} className="text-slate-400" />
                    Fin: {new Date(course.end_date).toLocaleDateString("es-EC", { dateStyle: "medium" })}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <DollarSign size={11} className="text-gold-500" />
                    ${Number(course.total_cost).toFixed(0)}
                  </span>
                </div>
                {course.description && (
                  <p className="mt-2 text-[11px] text-slate-400 leading-relaxed line-clamp-2">{course.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Formulario de inscripción */}
        <form onSubmit={submit} noValidate>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 p-6 sm:p-8">
            <h1 className="text-xl font-bold text-slate-900 mb-1">Formulario de Inscripción</h1>
            <p className="text-sm text-slate-500 mb-7 leading-relaxed">
              Completa tus datos para registrarte. Nuestro equipo revisará tu solicitud y te contactará para confirmar la inscripción y el proceso de pago.
            </p>

            <div className="grid gap-5">
              {/* Nombre completo */}
              <FormField label="Nombre completo *" icon={<User size={14} />} error={errors.full_name}>
                <input
                  type="text"
                  className={fieldClass(!!errors.full_name)}
                  value={form.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  placeholder="Ej: María Fernanda López Ruiz"
                  autoComplete="name"
                />
              </FormField>

              {/* Documento */}
              <FormField label="Cédula / Pasaporte *" icon={<FileText size={14} />} error={errors.document_number}>
                <input
                  type="text"
                  inputMode="numeric"
                  className={fieldClass(!!errors.document_number)}
                  value={form.document_number}
                  onChange={(e) => handleChange("document_number", e.target.value)}
                  placeholder="Ej: 1720304050"
                  autoComplete="off"
                />
              </FormField>

              {/* Teléfono y Email en grid */}
              <div className="grid sm:grid-cols-2 gap-5">
                <FormField label="Teléfono *" icon={<Phone size={14} />} error={errors.phone}>
                  <input
                    type="tel"
                    className={fieldClass(!!errors.phone)}
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="Ej: 0998214857"
                    autoComplete="tel"
                  />
                </FormField>

                <FormField label="Correo electrónico *" icon={<Mail size={14} />} error={errors.email}>
                  <input
                    type="email"
                    className={fieldClass(!!errors.email)}
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="tu@email.com"
                    autoComplete="email"
                  />
                </FormField>
              </div>



              {/* Notas / Comentarios */}
              <FormField label="Comentarios adicionales (opcional)" icon={<BookOpen size={14} />}>
                <textarea
                  className={`${fieldClass(false)} min-h-[90px] resize-none`}
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="¿Alguna pregunta o comentario sobre el curso?"
                />
              </FormField>
            </div>

            {/* Error de envío */}
            {step === "error" && submitError && (
              <div className="mt-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            )}

            {/* Botón de envío */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-between">
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                Al enviar confirmas que la información es correcta. Tu inscripción estará sujeta a confirmación de disponibilidad.
              </p>
              <button
                type="submit"
                disabled={step === "submitting"}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-gold-400 hover:text-gold-300 text-sm font-semibold transition-all shadow-lg shadow-slate-900/20 disabled:opacity-60 disabled:cursor-not-allowed group flex-shrink-0"
              >
                <GraduationCap size={16} className="group-hover:scale-105 transition-transform" />
                {step === "submitting" ? "Enviando…" : "Enviar inscripción"}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function fieldClass(hasError: boolean) {
  return `w-full px-4 py-3 rounded-xl border text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${
    hasError
      ? "border-red-300 bg-red-50 focus:ring-red-200 focus:border-red-400"
      : "border-slate-200 bg-slate-50 hover:border-slate-300 focus:bg-white"
  }`;
}

function FormField({
  label,
  icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
        {icon && <span className="text-gold-500">{icon}</span>}
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}
