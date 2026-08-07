import { redirect } from "next/navigation";

export default async function AvisosRedirect({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ course_id?: string; status?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const params = new URLSearchParams();
  params.set("tab", "avisos");
  if (searchParams.course_id) params.set("course_id", searchParams.course_id);
  if (searchParams.status) params.set("status", searchParams.status);

  redirect(`/erp/cursos/clases?${params.toString()}`);
}
