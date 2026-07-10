import { createAdminClient } from "@/lib/supabase/admin";
import { GraduationCap, Plus, Calendar, Users, DollarSign, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function CursosPage() {
  await assertPermission("/erp/cursos");
  const canEdit = await hasWritePermission("/erp/cursos");

  const supabase = createAdminClient();

  // 1. Cargar cursos, alumnos matriculados por curso, y estadísticas
  const [cursosRes, enrolRes] = await Promise.all([
    supabase
      .from("cursos")
      .select("*, curso_modulos(id, cost)")
      .order("start_date", { ascending: false }),
    supabase
      .from("curso_inscripciones")
      .select("id, course_id, status")
  ]);

  const cursos = cursosRes.data || [];
  const enrollments = enrolRes.data || [];

  // Mapear cantidad de alumnos activos por curso
  const studentCountMap = new Map<string, number>();
  enrollments.forEach((e) => {
    if (e.status === "enrolled") {
      studentCountMap.set(e.course_id, (studentCountMap.get(e.course_id) || 0) + 1);
    }
  });

  // Estadísticas básicas
  const totalActive = cursos.filter(c => c.status === "active").length;
  const totalDraft = cursos.filter(c => c.status === "draft").length;
  const totalStudents = enrollments.filter(e => e.status === "enrolled").length;

  const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
    draft:     { label: "Borrador", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    active:    { label: "Activo", cls: "bg-green-100 text-green-700 border-green-200" },
    completed: { label: "Completado", cls: "bg-lilac-100 text-lilac-700 border-lilac-200" },
    cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-700 border-red-200" },
  };

  const formatDateES = (d: string) => {
    return new Date(d + "T12:00:00").toLocaleDateString("es-EC", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <GraduationCap size={24} className="text-lilac-600" />
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Apertura y Control de Cursos</h1>
            <p className="text-sm text-ink-600">Apertura cursos, configura módulos, asocia profesores y gestiona alumnos.</p>
          </div>
        </div>
        {canEdit && (
          <Link
            href="/erp/cursos/nuevo"
            className="flex items-center gap-1.5 bg-lilac-600 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl hover:bg-lilac-700 transition font-medium shadow-sm w-fit"
          >
            <Plus size={16} /> Aperturar Curso
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Cursos Activos", value: totalActive, bg: "bg-green-50/50 border-green-100", text: "text-green-700", icon: <GraduationCap size={18} /> },
          { label: "Alumnos Matriculados", value: totalStudents, bg: "bg-lilac-50/50 border-lilac-100", text: "text-lilac-700", icon: <Users size={18} /> },
          { label: "En Borrador", value: totalDraft, bg: "bg-gray-50 border-gray-100", text: "text-gray-600", icon: <BookOpen size={18} /> },
        ].map((stat, idx) => (
          <div key={idx} className={`card p-4 bg-white border shadow-sm flex items-center gap-4 ${stat.bg}`}>
            <div className={`w-10 h-10 rounded-xl bg-white border border-inherit flex items-center justify-center ${stat.text}`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-xs text-ink-500 font-medium">{stat.label}</div>
              <div className="text-xl font-bold text-ink-900 leading-tight mt-0.5">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Course List */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cursos.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 card p-8 text-center text-sm text-ink-500 italic bg-white border border-lilac-100 shadow-sm">
            No hay cursos aperturados. ¡Comienza abriendo uno nuevo!
          </div>
        ) : (
          cursos.map((c) => {
            const studentCount = studentCountMap.get(c.id) || 0;
            const badge = STATUS_BADGES[c.status] || STATUS_BADGES.draft;
            const modulesCount = c.curso_modulos?.length || 0;

            return (
              <div key={c.id} className="card bg-white border border-lilac-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                {c.image_url && (
                  <div className="h-32 w-full overflow-hidden border-b border-lilac-50">
                    <img 
                      src={c.image_url} 
                      alt={c.name} 
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-ink-400 font-semibold bg-lilac-50 px-2 py-0.5 rounded-full">
                      {modulesCount} {modulesCount === 1 ? "módulo" : "módulos"}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-ink-900 leading-snug text-base line-clamp-1">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-lilac-50 grid grid-cols-2 gap-3 text-xs text-ink-600">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">Duración</span>
                      <div className="flex items-center gap-1.5 font-medium text-ink-850">
                        <Calendar size={13} className="text-lilac-500 shrink-0" />
                        <span className="truncate">{formatDateES(c.start_date)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">Alumnos</span>
                      <div className="flex items-center gap-1.5 font-medium text-ink-850">
                        <Users size={13} className="text-lilac-500 shrink-0" />
                        <span>{studentCount} / {c.max_students || "∞"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-lilac-50/20 border-t border-lilac-50/70 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-0.5 font-bold text-lilac-800 text-sm">
                    <DollarSign size={14} className="text-lilac-600 shrink-0" />
                    <span>{Number(c.total_cost).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</span>
                  </div>
                  
                  <Link
                    href={`/erp/cursos/${c.id}`}
                    className="inline-flex items-center gap-1 text-xs text-lilac-700 hover:text-lilac-900 font-semibold transition-colors"
                  >
                    Gestionar <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
