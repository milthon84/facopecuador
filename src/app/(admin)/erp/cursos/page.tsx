import { createAdminClient } from "@/lib/supabase/admin";
import { GraduationCap, Plus, BookOpen, FileText, Clock } from "lucide-react";
import Link from "next/link";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { updateExpiredCourses } from "@/lib/courses";
import CursosListClient from "./CursosListClient";

export const dynamic = "force-dynamic";

export default async function CursosPage() {
  await assertPermission("/erp/cursos");
  const canEdit = await hasWritePermission("/erp/cursos");

  const supabase = createAdminClient();

  // 1. Auto-completar cursos expirados en segundo plano
  updateExpiredCourses(supabase).catch(() => {});

  // 2. Cargar cursos, alumnos matriculados por curso, y estadísticas
  const [cursosRes, enrolRes] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, name, description, status, start_date, end_date, image_url, max_students, total_cost, curso_modulos(id, cost)")
      .order("start_date", { ascending: false }),
    supabase
      .from("curso_inscripciones")
      .select("id, course_id, status")
  ]);

  const cursos = cursosRes.data || [];
  const enrollments = enrolRes.data || [];

  // Mapear cantidad de alumnos activos por curso (objeto serializable para Client Component)
  const studentCountMap: Record<string, number> = {};
  enrollments.forEach((e) => {
    if (e.status === "enrolled") {
      studentCountMap[e.course_id] = (studentCountMap[e.course_id] || 0) + 1;
    }
  });

  // Estadísticas básicas
  const totalDraft = cursos.filter(c => c.status === "draft").length;
  const totalActiveOnly = cursos.filter(c => c.status === "active").length;
  const totalInProgress = cursos.filter(c => c.status === "in_progress").length;
  const totalClosed = cursos.filter(c => c.status === "completed" || c.status === "cancelled").length;

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap size={24} className="text-lilac-600" />
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Gestión y Control de Cursos</h1>
            <p className="text-sm text-ink-600">Administra cursos, configura módulos, asocia profesores y gestiona alumnos.</p>
          </div>
        </div>
        {canEdit && (
          <Link
            href="/erp/cursos/nuevo"
            className="flex items-center gap-1.5 bg-lilac-600 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-lilac-700 transition font-medium shadow-sm w-fit"
          >
            <Plus size={16} /> Nuevo Curso
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-8">
        {[
          { label: "Total Operativos", value: totalDraft + totalActiveOnly + totalInProgress, bg: "bg-lilac-50/70 border-lilac-150", text: "text-lilac-700", icon: <BookOpen size={18} /> },
          { label: "En Borrador", value: totalDraft, bg: "bg-gray-50 border-gray-100", text: "text-gray-600", icon: <FileText size={18} /> },
          { label: "Activos", value: totalActiveOnly, bg: "bg-green-50/50 border-green-100", text: "text-green-700", icon: <GraduationCap size={18} /> },
          { label: "En Ejecución", value: totalInProgress, bg: "bg-blue-50/50 border-blue-100", text: "text-blue-700", icon: <Clock size={18} /> },
        ].map((stat, idx) => (
          <div key={idx} className={`card p-3.5 bg-white border shadow-sm flex items-center gap-3 ${stat.bg}`}>
            <div className={`w-9 h-9 rounded-xl bg-white border border-inherit flex items-center justify-center shrink-0 ${stat.text}`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-[11px] text-ink-500 font-semibold">{stat.label}</div>
              <div className="text-lg font-bold text-ink-900 leading-tight mt-0.5">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Secciones de Cursos */}
      <CursosListClient
        cursos={cursos}
        studentCountMap={studentCountMap}
        canEdit={canEdit}
      />
    </div>
  );
}
