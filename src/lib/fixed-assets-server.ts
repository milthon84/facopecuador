import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Genera el siguiente código secuencial para un tipo de activo (ej. EQM-0001, COM-0001, MUE-0001)
 * Función de servidor exclusiva.
 */
export async function getNextAssetCode(prefix: string): Promise<string> {
  const cleanPrefix = (prefix || "ACT").trim().toUpperCase();
  const supabase = createAdminClient();

  const { data: assets } = await supabase
    .from("fixed_assets")
    .select("description, name");

  let maxSeq = 0;
  const regex = new RegExp(`${cleanPrefix}-(\\d{4})`, "i");

  if (assets && assets.length > 0) {
    for (const a of assets) {
      const text = `${a.name || ""} ${a.description || ""}`;
      const m = text.match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextNum = maxSeq + 1;
  return `${cleanPrefix}-${String(nextNum).padStart(4, "0")}`;
}
