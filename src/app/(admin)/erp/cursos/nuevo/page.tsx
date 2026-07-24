import { GraduationCap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { assertWritePermission } from "@/lib/auth-action";
import NuevoCursoForm from "@/components/NuevoCursoForm";

export const dynamic = "force-dynamic";

export default async function NuevoCursoPage() {
  await assertWritePermission("/erp/cursos");

  return (
    <div className="max-w-2xl mx-auto pb-10">
      <Link href="/erp/cursos" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900 mb-4 transition-colors">
        <ArrowLeft size={16} /> Volver a Cursos
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <GraduationCap size={24} className="text-lilac-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Aperturar Nuevo Curso</h1>
          <p className="text-sm text-ink-600">Completa los datos generales para crear un nuevo programa de formación.</p>
        </div>
      </div>

      <div className="card p-6 bg-white border border-lilac-100 shadow-sm">
        <NuevoCursoForm />
      </div>
    </div>
  );
}
