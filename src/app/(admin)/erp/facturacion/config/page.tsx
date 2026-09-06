import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ArrowLeft, Save, Building2, Key, Hash, AlertTriangle, Settings } from "lucide-react";
import SriAmbienteSection from "@/components/SriAmbienteSection";

export const dynamic = "force-dynamic";

export default async function SriConfigPage(props: { searchParams: Promise<{ error?: string, msg?: string }> }) {
  const searchParams = await props.searchParams;
  // Solo administradores pueden acceder
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if ((user?.app_metadata?.role as string) !== "admin") redirect("/erp");

  const supabase = createAdminClient();
  const { data: config } = await supabase.from("sri_configs").select("*").single();

  async function saveEmisor(formData: FormData) {
    "use server";
    const actionSupabase = createAdminClient();
    const updates = {
      ruc:              formData.get("ruc") as string,
      razon_social:     formData.get("razon_social") as string,
      nombre_comercial: formData.get("nombre_comercial") as string,
      establecimiento:  formData.get("establecimiento") as string,
      punto_emision:    formData.get("punto_emision") as string,
      direccion_matriz: formData.get("direccion_matriz") as string,
      obligado_contabilidad: formData.get("obligado_contabilidad") === "on",
    };
    const id = formData.get("id") as string;
    if (id) await actionSupabase.from("sri_configs").update(updates).eq("id", id);
    else await actionSupabase.from("sri_configs").insert(updates);
    revalidatePath("/erp/facturacion/config");
    redirect("/erp/facturacion/config?msg=emisor_ok");
  }

  async function saveEntorno(formData: FormData) {
    "use server";
    const actionSupabase = createAdminClient();
    const ambiente = formData.get("ambiente") as string;
    if (ambiente === "2") {
      const { data: cfg } = await actionSupabase.from("sri_configs").select("p12_storage_path").single();
      if (!cfg?.p12_storage_path) redirect("/erp/facturacion/config?error=cert_required");
    }
    const id = formData.get("id") as string;
    if (id) await actionSupabase.from("sri_configs").update({ ambiente }).eq("id", id);
    else await actionSupabase.from("sri_configs").insert({ ambiente });
    revalidatePath("/erp/facturacion/config");
    redirect("/erp/facturacion/config?msg=entorno_ok");
  }

  async function saveDescuento(formData: FormData) {
    "use server";
    const actionSupabase = createAdminClient();
    const updates = {
      cash_discount_percent: Number(formData.get("cash_discount_percent") || 0),
    };
    const id = formData.get("id") as string;
    let err = null;
    if (id) {
      const { error } = await actionSupabase.from("sri_configs").update(updates).eq("id", id);
      err = error;
    } else {
      const { error } = await actionSupabase.from("sri_configs").insert(updates);
      err = error;
    }
    
    if (err) {
      console.error("Error saving discount:", err);
      const isMissingColumn = err.code === '42703' || err.code === 'PGRST204';
      redirect(`/erp/facturacion/config?error=${isMissingColumn ? 'missing_column' : 'unknown_error'}`);
    }
    
    revalidatePath("/erp/facturacion/config");
    redirect("/erp/facturacion/config?msg=descuento_ok");
  }

  async function avanzarSecuencial(formData: FormData) {
    "use server";
    const adminClient = createAdminClient();
    const nuevoMinimo = Number(formData.get("nuevo_minimo"));
    if (nuevoMinimo > 0) {
      await adminClient.rpc("avanzar_secuencial_a", { nuevo_minimo: nuevoMinimo });
    }
    revalidatePath("/erp/facturacion/config");
    redirect("/erp/facturacion/config?msg=sec_ok");
  }

  // Estado actual del secuencial
  const supabase2 = createAdminClient();
  const { data: secState } = await supabase2.rpc("estado_secuencial").single() as any;
  const hasCert = !!config?.p12_storage_path;

  // Leer info del certificado para verificar que el RUC coincide
  let certInfo: { subject: string; serialNumber: string; validFrom: string; validTo: string } | null = null;
  let certRucMatch: boolean | null = null;
  if (hasCert && config?.signature_password) {
    try {
      const { parseCertInfo } = await import("@/lib/sri-sign");
      const { data: p12Data } = await supabase2.storage.from("sri-certificates").download(config.p12_storage_path);
      if (p12Data) {
        const p12Buffer = Buffer.from(await p12Data.arrayBuffer());
        certInfo = parseCertInfo(p12Buffer, config.signature_password);
        const rucConfigured = config.ruc ?? "";
        certRucMatch = certInfo.subject.includes(rucConfigured) ||
                       certInfo.subject.includes(rucConfigured.slice(0, 10));
      }
    } catch { /* ignorar si no se puede leer */ }
  }

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header compacto */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/erp/facturacion"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2"><Settings size={20} className="text-lilac-600"/> Configuración</h1>
          <p className="text-xs text-ink-500">Configuración por secciones: Datos del Emisor (SRI), Descuentos, Entorno y Secuencial</p>
        </div>
      </div>

      {searchParams.error === "missing_column" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <strong>Error de Base de Datos:</strong> No se pudo guardar el descuento porque falta agregar la columna en Supabase.
          <br /><br />
          Para solucionarlo, debes:
          <ol className="list-decimal ml-5 mt-1 space-y-1">
            <li>Entrar a tu cuenta de Supabase (app.supabase.com)</li>
            <li>Ir al menú <strong>SQL Editor</strong></li>
            <li>Abrir un <strong>New query</strong></li>
            <li>Copiar y ejecutar este código exactamente:
              <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-x-auto text-red-900 font-mono">
                ALTER TABLE public.sri_configs ADD COLUMN IF NOT EXISTS cash_discount_percent numeric(5,2) not null default 6.00;
              </pre>
            </li>
          </ol>
        </div>
      )}
      {searchParams.error === "unknown_error" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          Ocurrió un error inesperado al intentar guardar la configuración.
        </div>
      )}
      {searchParams.msg === "descuento_ok" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
          Descuento guardado exitosamente.
        </div>
      )}
      {searchParams.msg === "emisor_ok" && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
          Datos del emisor guardados exitosamente.
        </div>
      )}

      <div className="space-y-6">

        {/* ── Datos del Emisor ───────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm">
          <form action={saveEmisor} className="p-4 sm:p-6 space-y-4">
            <input type="hidden" name="id" value={config?.id || ""} />
            <h4 className="font-semibold text-sm text-ink-700 flex items-center gap-2 border-b border-lilac-50 pb-2">
              <Building2 size={15} className="text-lilac-500" />
              Sección: SRI (Datos del Emisor)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">RUC *</label>
                <input type="text" name="ruc" required defaultValue={config?.ruc || ""} maxLength={13} placeholder="1790000000001" className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Razón Social *</label>
                <input type="text" name="razon_social" required defaultValue={config?.razon_social || ""} placeholder="Nombre legal completo" className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 uppercase" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Nombre Comercial</label>
              <input type="text" name="nombre_comercial" defaultValue={config?.nombre_comercial || ""} placeholder="Nombre público de la clínica" className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Establecimiento *</label>
                <input type="text" name="establecimiento" required defaultValue={config?.establecimiento || "001"} maxLength={3} className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono text-center" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-700">Punto Emisión *</label>
                <input type="text" name="punto_emision" required defaultValue={config?.punto_emision || "001"} maxLength={3} className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono text-center" />
              </div>
              <div className="space-y-1 col-span-2 md:col-span-1">
                <label className="text-xs font-semibold text-ink-700">&nbsp;</label>
                <label className="flex items-center gap-2 bg-lilac-50/30 border border-lilac-100 px-3 py-2 rounded-xl cursor-pointer hover:bg-lilac-50 transition-colors h-[38px]">
                  <input type="checkbox" name="obligado_contabilidad" defaultChecked={config?.obligado_contabilidad} className="w-4 h-4 rounded border-lilac-300 text-lilac-600 focus:ring-lilac-500" />
                  <span className="text-xs font-medium text-ink-700">Obligado contabilidad</span>
                </label>
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Dirección Matriz *</label>
              <input type="text" name="direccion_matriz" required defaultValue={config?.direccion_matriz || ""} placeholder="Dirección fiscal registrada en SRI" className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500" />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="flex items-center gap-2 bg-lilac-600 hover:bg-lilac-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold text-sm shadow-md shadow-lilac-200">
                <Save size={16} /> Guardar Datos del Emisor
              </button>
            </div>
          </form>
        </div>

        {/* ── Descuento por Pago ───────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm">
          <form action={saveDescuento} className="p-4 sm:p-6 space-y-4">
            <input type="hidden" name="id" value={config?.id || ""} />
            <h4 className="font-semibold text-sm text-ink-700 flex items-center gap-2 border-b border-lilac-50 pb-2">
              <Settings size={15} className="text-green-600" />
              Sección: Descuentos y Recargos
            </h4>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink-700">Descuento por Pago al Contado / Transferencia (%) *</label>
              <div className="relative">
                <input type="number" name="cash_discount_percent" min="0" max="100" step="0.01" required defaultValue={config?.cash_discount_percent ?? config?.card_surcharge_percent ?? 6.00} className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-mono text-right font-bold text-green-700" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm">%</span>
              </div>
              <p className="text-[11px] text-ink-400">Descuento automático aplicado al facturar en Efectivo o Transferencia. El pago con Tarjeta cobra la tarifa completa (PVP).</p>
            </div>
            
            <div className="flex justify-end pt-2">
              <button type="submit" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold text-sm shadow-md shadow-green-200">
                <Save size={16} /> Guardar Descuento
              </button>
            </div>
          </form>
        </div>

        {/* ── Entorno y Firma ────────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm">
          <form action={saveEntorno} className="p-4 sm:p-6 space-y-4">
            <input type="hidden" name="id" value={config?.id || ""} />
            <h4 className="font-semibold text-sm text-ink-700 flex items-center gap-2 border-b border-lilac-50 pb-2">
              <Key size={15} className="text-gold-500" />
              Sección: Entorno y Firma Electrónica
            </h4>

            <SriAmbienteSection defaultAmbiente={config?.ambiente ?? "1"} hasCert={hasCert} certSubject={config?.p12_cert_subject ?? null} certExpires={config?.p12_cert_expires ?? null} />

            {certInfo && (
              <div className="rounded-xl px-4 py-3 border text-xs space-y-1 bg-blue-50 border-blue-200 mt-4">
                <p className="font-bold text-blue-800 flex items-center gap-1.5">ℹ Información del certificado cargado</p>
                <p className="text-ink-600 font-mono text-[11px] break-all">CN: {certInfo.subject.split("CN=")[1]?.split(",")[0]?.split("|")[0]?.trim() ?? certInfo.subject}</p>
                <p className="text-ink-500 text-[11px]">Vigencia: {certInfo.validFrom} → {certInfo.validTo}</p>
                <p className="text-blue-700 text-[11px]">✓ El RUC del certificado se verifica directamente en el SRI — si la factura llega como "Rechazado" el certificado es correcto.</p>
              </div>
            )}

            <div className="flex justify-end pt-2 mt-4">
              <button type="submit" className="flex items-center gap-2 bg-gold-600 hover:bg-gold-700 text-white px-6 py-2.5 rounded-xl transition-colors font-semibold text-sm shadow-md shadow-gold-200">
                <Save size={16} /> Guardar Entorno y Firma
              </button>
            </div>
          </form>
        </div>

        {/* ── Secuencial de Facturas ─────────────────────────── */}
        <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
          <h4 className="font-semibold text-sm text-ink-700 flex items-center gap-2 pb-2 border-b border-lilac-50">
            <Hash size={15} className="text-lilac-500" />
            Sección: Secuencial de Facturas
          </h4>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>El secuencial NUNCA retrocede.</strong> Si el SRI ya tiene registradas facturas hasta un número,
              el sistema siempre continuará desde el máximo emitido para evitar el error <em>"Clave de acceso registrada"</em>.
            </p>
          </div>

          {secState && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-lilac-50 border border-lilac-100 rounded-xl p-3">
                <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Último emitido</p>
                <p className="font-bold text-ink-900 font-mono text-sm">
                  {String(secState.max_emitido || 0).padStart(9, "0")}
                </p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Próxima factura</p>
                <p className="font-bold text-green-700 font-mono text-sm">
                  {String(secState.proxima_factura || 1).padStart(9, "0")}
                </p>
              </div>
              <div className="bg-white border border-lilac-100 rounded-xl p-3">
                <p className="text-[10px] text-ink-400 uppercase font-semibold mb-1">Última factura</p>
                <p className="font-bold text-ink-700 font-mono text-xs truncate">
                  {secState.ultima_factura_nro || "—"}
                </p>
              </div>
            </div>
          )}

          <form action={avanzarSecuencial} className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-semibold text-ink-700">
                Avanzar secuencial al número (solo si el SRI ya tiene facturas anteriores en este entorno)
              </label>
              <input type="number" name="nuevo_minimo" min="1" required
                placeholder={`Ej: ${(secState?.proxima_factura || 1) + 10}`}
                className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white font-mono" />
              <p className="text-[11px] text-ink-400">
                Solo se aplica si el número ingresado es <strong>mayor</strong> al secuencial actual. No puede retroceder.
              </p>
            </div>
            <button type="submit"
              className="shrink-0 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
              <Hash size={14} /> Avanzar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
