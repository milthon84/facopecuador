import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("web_settings")
      .select("value")
      .eq("key", "ads_config")
      .maybeSingle();

    const url = data?.value?.url || process.env.ADS_API_URL || process.env.NEXT_PUBLIC_ADS_API_URL || "";
    const claudeKey = data?.value?.claudeKey || process.env.ANTHROPIC_API_KEY || "";

    return NextResponse.json({ success: true, url, claudeKey });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, url: "", claudeKey: "" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const sessionClient = createClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    if ((user?.app_metadata?.role as string) !== "admin") {
      return NextResponse.json(
        { error: "No tienes permisos de administrador para guardar esta configuración." },
        { status: 403 }
      );
    }

    const { url, claudeKey } = await req.json();

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("web_settings")
      .upsert(
        { key: "ads_config", value: { url: url?.trim() || "", claudeKey: claudeKey?.trim() || "" } },
        { onConflict: "key" }
      );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Error al guardar configuración" },
      { status: 500 }
    );
  }
}
