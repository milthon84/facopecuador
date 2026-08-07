import { redirect } from "next/navigation";

export default async function FacturacionRedirect({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ course_id?: string; status?: string; q?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const params = new URLSearchParams();
  params.set("tab", "clases");
  if (searchParams.course_id) params.set("course_id", searchParams.course_id);
  if (searchParams.q) params.set("q", searchParams.q);

  redirect(`/erp/cursos/clases?${params.toString()}`);
}
