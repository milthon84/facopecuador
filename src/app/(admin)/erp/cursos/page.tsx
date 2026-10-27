import { createAdminClient } from "@/lib/supabase/admin";
import { GraduationCap, Plus, BookOpen, FileText, Clock, CalendarDays } from "lucide-react";
import Link from "next/link";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";
import { updateExpiredCourses } from "@/lib/courses";
import CursosListClient from "./CursosListClient";
import CourseAgendaResumida, { ScheduledClass, CourseOption } from "@/components/CourseAgendaResumida";

export const dynamic = "force-dynamic";

const COURSE_COLOR_PALETTES = [
  "border-lilac-400 bg-lilac-50/90 text-lilac-950",
  "border-blue-400 bg-blue-50/90 text-blue-950",
  "border-emerald-400 bg-emerald-50/90 text-emerald-950",
  "border-amber-400 bg-amber-50/90 text-amber-950",
  "border-rose-400 bg-rose-50/90 text-rose-950",
  "border-indigo-400 bg-indigo-50/90 text-indigo-950",
  "border-teal-400 bg-teal-50/90 text-teal-950",
  "border-cyan-400 bg-cyan-50/90 text-cyan-950",
];

export default async function CursosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const activeTab = searchParams.tab === "agenda" ? "agenda" : "catalogo";

  await assertPermission("/erp/cursos");
  const canEdit = await hasWritePermission("/erp/cursos");

  const supabase = createAdminClient();

  // 1. Auto-completar cursos expirados en segundo plano
  updateExpiredCourses(supabase).catch(() => {});

  // 2. Cargar cursos, alumnos matriculados por curso, clases y módulos en paralelo
  const [cursosRes, enrolRes, classesRes, modulesRes] = await Promise.all([
    supabase
      .from("cursos")
      .select("id, name, description, status, start_date, end_date, image_url, max_students, total_cost, curso_modulos(id, cost)")
      .order("start_date", { ascending: false }),
    supabase
      .from("curso_inscripciones")
      .select("id, course_id, status"),
    supabase
      .from("curso_clases")
      .select(`
        id, module_id, title, description, date, start_time, end_time, teacher_id, classroom,
        profesores (id, full_name, specialty),
        curso_modulos (id, number, name, course_id, cursos (id, name, status))
      `)
      .order("date")
      .order("start_time"),
    supabase
      .from("curso_modulos")
      .select("id, course_id, number, name, start_date, end_date, cursos (id, name, status)")
      .order("number"),
  ]);

  const cursos = cursosRes.data || [];
  const enrollments = enrolRes.data || [];
  const rawClasses = classesRes.data || [];
  const rawModules = modulesRes.data || [];

  // Mapear cantidad de alumnos activos por curso (objeto serializable para Client Component)
  const studentCountMap: Record<string, number> = {};
  enrollments.forEach((e) => {
    if (e.status === "enrolled") {
      studentCountMap[e.course_id] = (studentCountMap[e.course_id] || 0) + 1;
    }
  });

  // Estadísticas básicas del catálogo
  const totalDraft = cursos.filter(c => c.status === "draft").length;
  const totalActiveOnly = cursos.filter(c => c.status === "active").length;
  const totalInProgress = cursos.filter(c => c.status === "in_progress").length;

  // Asignar colores por curso para la agenda (excluyendo cursos cancelados)
  const nonCancelledCourses = cursos.filter(
    (c) => c.status !== "cancelled" && c.status !== "cancelado"
  );
  const activeCourseIdSet = new Set(nonCancelledCourses.map((c) => c.id));

  const courseColorMap = new Map<string, string>();
  nonCancelledCourses.forEach((c, index) => {
    courseColorMap.set(c.id, COURSE_COLOR_PALETTES[index % COURSE_COLOR_PALETTES.length]);
  });

  const coursesForAgenda: CourseOption[] = nonCancelledCourses.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    color: courseColorMap.get(c.id) || COURSE_COLOR_PALETTES[0],
  }));

  // Consolidar clases para la agenda (solo de cursos vigentes / no cancelados)
  const agendaClasses: ScheduledClass[] = [];

  rawClasses.forEach((cls: any) => {
    const courseId = cls.curso_modulos?.course_id || cls.curso_modulos?.cursos?.id || "";
    if (!activeCourseIdSet.has(courseId)) return;
    const courseStatus = cls.curso_modulos?.cursos?.status;
    if (courseStatus === "cancelled" || courseStatus === "cancelado") return;

    const courseName = cls.curso_modulos?.cursos?.name || "Curso";
    const moduleName = cls.curso_modulos ? `Módulo ${cls.curso_modulos.number}: ${cls.curso_modulos.name}` : "Módulo";
    const color = courseColorMap.get(courseId) || COURSE_COLOR_PALETTES[0];

    agendaClasses.push({
      id: cls.id,
      moduleId: cls.module_id,
      moduleName,
      moduleNumber: cls.curso_modulos?.number || 1,
      courseId,
      courseName,
      title: cls.title || "Sesión de Clase",
      date: cls.date,
      startTime: (cls.start_time || "08:00").slice(0, 5),
      endTime: (cls.end_time || "17:00").slice(0, 5),
      teacherName: cls.profesores?.full_name || null,
      classroom: cls.classroom || null,
      courseColor: color,
    });
  });

  // Agregar fechas planificadas de módulos si no tienen sesiones individuales aún (excluyendo cancelados)
  const existingDatesByModule = new Set(agendaClasses.map((c) => `${c.moduleId}_${c.date}`));
  rawModules.forEach((m: any) => {
    if (!activeCourseIdSet.has(m.course_id)) return;
    const courseStatus = m.cursos?.status;
    if (courseStatus === "cancelled" || courseStatus === "cancelado") return;

    if (m.start_date && !existingDatesByModule.has(`${m.id}_${m.start_date}`)) {
      const color = courseColorMap.get(m.course_id) || COURSE_COLOR_PALETTES[0];
      agendaClasses.push({
        id: `mod_${m.id}`,
        moduleId: m.id,
        moduleName: `Módulo ${m.number}: ${m.name}`,
        moduleNumber: m.number,
        courseId: m.course_id,
        courseName: m.cursos?.name || "Curso",
        title: `Módulo ${m.number} (Fecha Programada)`,
        date: m.start_date.split("T")[0],
        startTime: "08:00",
        endTime: "17:00",
        teacherName: null,
        classroom: null,
        courseColor: color,
      });
    }
  });

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-4">
      {/* Header General Compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-lilac-50 border border-lilac-200 text-lilac-700 flex items-center justify-center shrink-0 shadow-2xs">
            <GraduationCap size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-ink-950 tracking-tight leading-tight">Cursos y Programas</h1>
            <p className="text-xs text-ink-500 font-medium">Gestión de cursos, cronograma de módulos y agenda de clases de fin de semana.</p>
          </div>
        </div>

        {canEdit && (
          <Link
            href="/erp/cursos/nuevo"
            className="flex items-center gap-1.5 bg-lilac-600 text-white text-xs px-3.5 py-2 rounded-xl hover:bg-lilac-700 transition font-bold shadow-sm w-fit"
          >
            <Plus size={15} /> Nuevo Curso
          </Link>
        )}
      </div>

      {/* PESTAÑAS COMPACTAS (CATÁLOGO vs AGENDA DE CLASES) */}
      <div className="flex border-b border-lilac-150 gap-1.5 overflow-x-auto">
        <Link
          href="/erp/cursos?tab=catalogo"
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
            activeTab === "catalogo"
              ? "border-lilac-600 text-lilac-800 bg-white shadow-2xs"
              : "border-transparent text-ink-500 hover:text-ink-900 hover:bg-lilac-50/40"
          }`}
        >
          <GraduationCap size={15} className={activeTab === "catalogo" ? "text-lilac-600" : "text-ink-400"} />
          <span>Catálogo de Cursos ({cursos.length})</span>
        </Link>

        <Link
          href="/erp/cursos?tab=agenda"
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
            activeTab === "agenda"
              ? "border-lilac-600 text-lilac-800 bg-white shadow-2xs"
              : "border-transparent text-ink-500 hover:text-ink-900 hover:bg-lilac-50/40"
          }`}
        >
          <CalendarDays size={15} className={activeTab === "agenda" ? "text-lilac-600" : "text-ink-400"} />
          <span>Agenda y Feriados</span>
        </Link>
      </div>

      {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
      {activeTab === "catalogo" ? (
        <div className="space-y-6">
          {/* Stats Rápidas del Catálogo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {[
              { label: "Total Operativos", value: totalDraft + totalActiveOnly + totalInProgress, bg: "bg-lilac-50/70 border-lilac-150", text: "text-lilac-700", icon: <BookOpen size={18} /> },
              { label: "En Borrador", value: totalDraft, bg: "bg-gray-50 border-gray-100", text: "text-gray-600", icon: <FileText size={18} /> },
              { label: "Abiertos", value: totalActiveOnly, bg: "bg-green-50/50 border-green-100", text: "text-green-700", icon: <GraduationCap size={18} /> },
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

          {/* Listado de Cursos */}
          <CursosListClient
            cursos={cursos}
            studentCountMap={studentCountMap}
            canEdit={canEdit}
          />
        </div>
      ) : (
        /* PESTAÑA AGENDA Y CALENDARIO DE CLASES (RESUMIDA, FINES DE SEMANA, FERIADOS Y SOLO LECTURA) */
        <CourseAgendaResumida
          classes={agendaClasses}
          courses={coursesForAgenda}
        />
      )}
    </div>
  );
}
