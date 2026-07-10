import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Layers, Plus } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { hasPermission, type UserRole } from "@/lib/roles";
import { getCachedUserAndPermissions } from "@/lib/auth-cache";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const supabase = createAdminClient();
  const preselectedProduct = searchParams.product || "";

  // Ejecutar consulta de permisos, productos e historial en paralelo
  const [authData, productsRes, transactionsRes] = await Promise.all([
    getCachedUserAndPermissions(),
    supabase
      .from("inventory_products")
      .select("id, name, current_stock, unit_of_measure")
      .order("name"),
    supabase
      .from("inventory_transactions")
      .select("*, product:inventory_products(name, unit_of_measure)")
      .order("transaction_date", { ascending: false })
      .limit(50)
  ]);

  const { role, allowedPaths } = authData;
  const canModify = hasPermission(role, "/erp/inventario/transacciones/crear", allowedPaths);
  const products = productsRes.data;
  const transactions = transactionsRes.data;

  async function saveTransaction(formData: FormData) {
    "use server";
    const supabaseAction = createAdminClient();
    const sessionClient = createClient();
    const { data: { user: userAction } } = await sessionClient.auth.getUser();

    if (!userAction) {
      throw new Error("Sin sesión activa");
    }

    const roleAction = (userAction.app_metadata?.role as string) ?? "recepcionista";
    let allowedPathsAction: string[] | null = null;
    if (roleAction !== "admin") {
      const { data } = await supabaseAction
        .from("role_permissions")
        .select("path")
        .eq("role_name", roleAction);
      allowedPathsAction = (data || []).map((p: any) => p.path);
    }

    if (!hasPermission(roleAction, "/erp/inventario/transacciones/crear", allowedPathsAction)) {
      throw new Error("Sin permisos para registrar transacciones de inventario");
    }

    const product_id = formData.get("product_id") as string;
    const type = formData.get("type") as "entrada" | "salida";
    const quantity = Number(formData.get("quantity"));
    const reason = formData.get("reason") as string;

    if (!product_id || quantity <= 0) {
      throw new Error("Datos inválidos");
    }

    // Obtener nombre del producto para la auditoría
    const { data: prod } = await supabaseAction
      .from("inventory_products")
      .select("name, sku")
      .eq("id", product_id)
      .single();

    const { data: tx, error } = await supabaseAction
      .from("inventory_transactions")
      .insert({
        product_id,
        type,
        quantity,
        reason,
        created_by_id: userAction?.id ?? null,
        created_by_email: userAction?.email ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new Error("Error guardando transacción");
    }

    await logAudit({
      user_id: userAction?.id,
      user_email: userAction?.email,
      user_role: (userAction?.app_metadata?.role as UserRole) ?? null,
      action: "create",
      resource: "inventory_transaction",
      resource_id: tx?.id,
      description: `${type === "entrada" ? "Entrada" : "Salida"} de ${quantity} unidades de ${prod?.name || product_id}. Motivo: ${reason}`,
      metadata: { type, quantity, reason, product_name: prod?.name, sku: prod?.sku },
    });

    redirect("/erp/inventario/transacciones");
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/erp/inventario"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
            Transacciones de Inventario
          </h1>
          <p className="text-sm text-ink-600">
            {canModify ? "Registra entradas y salidas de insumos." : "Visualiza el historial de entradas y salidas."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Formulario de Nueva Transacción (solo si tiene permisos) */}
        {canModify && (
          <div className="md:col-span-1">
            <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm p-5 sticky top-6">
              <h2 className="font-semibold text-ink-900 flex items-center gap-2 mb-5">
                <Plus size={18} className="text-lilac-600" />
                Nuevo Registro
              </h2>
              <form action={saveTransaction} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-ink-700">Producto *</label>
                  <select
                    name="product_id"
                    required
                    defaultValue={preselectedProduct}
                    className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
                  >
                    <option value="" disabled>Selecciona un producto</option>
                    {products?.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.current_stock} en stock)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="cursor-pointer">
                    <input type="radio" name="type" value="entrada" className="peer sr-only" defaultChecked />
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-lilac-200 bg-white px-3 py-2.5 text-sm font-medium peer-checked:border-green-500 peer-checked:bg-green-50 peer-checked:text-green-700 transition-colors hover:bg-lilac-50">
                      <ArrowDownRight size={16} />
                      Entrada
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" name="type" value="salida" className="peer sr-only" />
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-lilac-200 bg-white px-3 py-2.5 text-sm font-medium peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700 transition-colors hover:bg-lilac-50">
                      <ArrowUpRight size={16} />
                      Salida
                    </div>
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-ink-700">Cantidad *</label>
                  <input
                    type="number"
                    name="quantity"
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500 font-bold text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-semibold text-ink-700">Motivo</label>
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Ej. Uso en clínica, Compra, Merma..."
                    className="w-full bg-lilac-50/50 border border-lilac-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lilac-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-lilac-600 hover:bg-lilac-700 text-white font-semibold py-2.5 rounded-xl transition-colors mt-2"
                >
                  Guardar Movimiento
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Historial Reciente */}
        <div className={canModify ? "md:col-span-2" : "md:col-span-3"}>
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-lilac-50 flex items-center gap-2">
              <Layers size={18} className="text-ink-500" />
              <h2 className="font-semibold text-ink-900">Historial Reciente (Últimos 50)</h2>
            </div>
            <div className="divide-y divide-lilac-50 max-h-[600px] overflow-y-auto">
              {!transactions || transactions.length === 0 ? (
                <div className="p-8 text-center text-ink-500 text-sm">
                  No hay transacciones registradas.
                </div>
              ) : (
                transactions.map((tx) => {
                  const isEntrada = tx.type === "entrada";
                  const dt = new Date(tx.transaction_date).toLocaleString('es-CO', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <div key={tx.id} className="p-4 hover:bg-lilac-50/50 flex items-center justify-between transition-colors">
                      <div className="flex flex-col">
                        <div className="font-medium text-ink-900 text-sm">
                          {(tx.product as any)?.name}
                        </div>
                        <div className="text-xs text-ink-500 mt-1 flex items-center gap-2">
                          <span className="opacity-70">{dt}</span>
                          <span className="w-1 h-1 rounded-full bg-ink-300"></span>
                          <span className="italic">{tx.reason}</span>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm ${isEntrada ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {isEntrada ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                        {isEntrada ? "+" : "-"}{tx.quantity}
                        <span className="text-[10px] uppercase font-semibold opacity-70 ml-0.5">
                          {(tx.product as any)?.unit_of_measure}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
