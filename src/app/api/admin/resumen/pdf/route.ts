import { NextRequest } from "next/server";
import { handleExecutiveSummaryRequest } from "@/app/api/admin/resumen-semanal/pdf/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return handleExecutiveSummaryRequest(req);
}
