import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function FacturacionConfigRedirect() {
  redirect("/erp/configuracion-sistema");
}
