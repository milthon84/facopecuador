import { createAdminClient } from "@/lib/supabase/admin";
import { CreditCard, Search, GraduationCap } from "lucide-react";
import Link from "next/link";
import CourseBillingTable from "@/components/CourseBillingTable";
import { assertPermission, hasWritePermission } from "@/lib/auth-action";

export const dynamic = "force-dynamic";

export default async function FacturacionCursosPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ course_id?: string; status?: string; q?: string }>;
}) {
  await assertPermission("/erp/cursos/facturacion");
  const canEdit = await hasWritePermission("/erp/cursos/facturacion");

  const searchParams = await searchParamsPromise;
  const courseId = searchParams.course_id || "";
  const filterStatus = searchParams.status || "pending"; // default to pending payments
  const searchQuery = searchParams.q || "";

  const supabase = createAdminClient();

  // 1. Cargar cursos para el filtro
  const { data: courses } = await supabase
    .from("cursos")
    .select("id, name")
    .order("name");

  // 2. Cargar registros de modulo_inscripciones con relaciones
  let query = supabase
    .from("curso_modulo_inscripciones")
    .select(`
      id,
      billing_status,
      invoice_id,
      curso_modulos: module_id (id, number, name, cost, course_id),
      curso_inscripciones: enrollment_id (
        id,
        status,
        alumnos: student_id (id, full_name, document_number, email, phone),
        cursos: course_id (id, name)
      ),
      invoices: invoice_id (id, invoice_number, sri_status)
    `);

  // Aplicar filtros
  if (filterStatus && filterStatus !== "all") {
    query = query.eq("billing_status", filterStatus);
  }

  const { data: rawItems } = await query;

  // 3. Procesar y aplanar los datos para el componente de cliente
  let billingItems = (rawItems || [])
    .map((item: any) => {
      const enrollment = item.curso_inscripciones;
      const student = enrollment?.alumnos;
      const course = enrollment?.cursos;
      const modulo = item.curso_modulos;

      if (!student || !course || !modulo) return null;

      return {
        id: item.id,
        billing_status: item.billing_status,
        invoice_id: item.invoice_id,
        curso_modulos: modulo,
        invoices: item.invoices,
        student: student,
        course_name: course.name,
      };
    })
    .filter(Boolean) as any[];

  // Filtrar por curso
  if (courseId) {
    billingItems = billingItems.filter((item) => item.curso_modulos.course_id === courseId);
  }

  // Filtrar por búsqueda textual (nombre o cédula del alumno)
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    billingItems = billingItems.filter(
      (item) =>
        item.student.full_name.toLowerCase().includes(q) ||
        item.student.document_number.includes(q)
    );
  }

  // Ordenar por fecha o nombre del alumno
  billingItems.sort((a, b) => a.student.full_name.localeCompare(b.student.full_name));

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard size={24} className="text-lilac-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Facturación de Módulos</h1>
          <p className="text-sm text-ink-600 font-medium">Controla los pagos por módulo, genera facturas SRI individuales o agrupadas por alumno.</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <form method="GET" action="/erp/cursos/facturacion" className="card p-4 bg-white border border-lilac-100 shadow-sm mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Búsqueda */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Buscar alumno</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Nombre o cédula..."
              className="w-full bg-white border border-lilac-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-500"
            />
          </div>
        </div>

        {/* Curso */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Curso</label>
          <select
            name="course_id"
            defaultValue={courseId}
            className="w-full bg-white border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-500"
          >
            <option value="">Todos los cursos...</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Estado Pago */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-700">Estado de pago</label>
          <select
            name="status"
            defaultValue={filterStatus}
            className="w-full bg-white border border-lilac-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-lilac-500"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes de Pago</option>
            <option value="invoiced">Facturados</option>
            <option value="free">Beca / Sin costo</option>
          </select>
        </div>

        {/* Botón */}
        <div className="flex items-end">
          <button type="submit" className="w-full btn-primary text-xs py-2 shadow-sm font-semibold">
            Aplicar Filtros
          </button>
        </div>
      </form>

      {/* Listado / Tabla */}
      <CourseBillingTable billingItems={billingItems} canEdit={canEdit} />
    </div>
  );
}
