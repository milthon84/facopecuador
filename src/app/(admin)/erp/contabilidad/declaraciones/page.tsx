import { createAdminClient } from "@/lib/supabase/admin";
import { assertPermission } from "@/lib/auth-action";
import DeclaracionesClient from "./DeclaracionesClient";
import type { TaxDeclarationDocument } from "@/lib/tax-declarations";

export const dynamic = "force-dynamic";

export default async function DeclaracionesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ period?: string; year?: string }>;
}) {
  await assertPermission("/erp/contabilidad");
  const searchParams = await searchParamsPromise;

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const period = searchParams.period ?? currentPeriod;
  const currentYear = Number(period.split("-")[0]) || now.getFullYear();

  const supabase = createAdminClient();

  // Consultar períodos cerrados y documentos existentes
  let tableMissing = false;
  let documents: TaxDeclarationDocument[] = [];
  let closedPeriods: string[] = [];

  try {
    const [{ data: closureData }, { data: docsData, error: docsError }] = await Promise.all([
      supabase.from("monthly_closures").select("period").eq("status", "closed"),
      supabase
        .from("tax_declaration_documents")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    closedPeriods = (closureData || []).map((c: any) => c.period);

    if (docsError) {
      if (
        docsError.code === "42P01" ||
        docsError.message.includes('relation "public.tax_declaration_documents" does not exist')
      ) {
        tableMissing = true;
      } else {
        console.error("Error consultando tax_declaration_documents:", docsError);
      }
    } else {
      documents = (docsData as TaxDeclarationDocument[]) || [];
    }
  } catch (err: any) {
    console.error("Error al cargar datos en DeclaracionesPage:", err);
    tableMissing = true;
  }

  return (
    <DeclaracionesClient
      initialDocuments={documents}
      initialPeriod={period}
      closedPeriods={closedPeriods}
      tableMissing={tableMissing}
    />
  );
}
