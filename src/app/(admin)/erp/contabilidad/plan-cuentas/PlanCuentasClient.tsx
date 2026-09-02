"use client";

import { useState } from "react";
import { Search, Folder, FileText } from "lucide-react";
import Link from "next/link";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
};

export default function PlanCuentasClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialAccounts.filter(a => 
    a.code.includes(search) || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Plan de Cuentas</h1>
          <p className="text-sm text-ink-500">Catálogo de cuentas contables, activos, pasivos y resultados.</p>
        </div>
        <Link href="/erp/contabilidad" className="text-sm font-semibold text-lilac-600 hover:text-lilac-800 hover:underline">
          ← Volver a Contabilidad
        </Link>
      </div>

      <div className="bg-white border border-lilac-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-lilac-50 flex items-center gap-3 bg-lilac-50/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-lilac-200 rounded-xl text-sm focus:outline-none focus:border-lilac-400 focus:ring-2 focus:ring-lilac-100 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-lilac-50/50 text-ink-500 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 w-32">Código</th>
                <th className="px-5 py-3">Nombre de Cuenta</th>
                <th className="px-5 py-3 w-32">Tipo</th>
                <th className="px-5 py-3 w-40">Subtipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-ink-400">
                    No se encontraron cuentas que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map(acc => {
                  const isGroup = acc.subtype === "grupo";
                  return (
                    <tr key={acc.id} className={`hover:bg-lilac-50/20 transition-colors ${isGroup ? 'bg-lilac-50/40 font-semibold' : ''}`}>
                      <td className="px-5 py-2.5 font-mono text-ink-600 text-xs">{acc.code}</td>
                      <td className="px-5 py-2.5 text-ink-900 flex items-center gap-2">
                        {isGroup ? <Folder size={14} className="text-lilac-500" /> : <FileText size={14} className="text-ink-300 ml-4" />}
                        {acc.name}
                      </td>
                      <td className="px-5 py-2.5 text-ink-500 text-xs font-medium">{acc.type}</td>
                      <td className="px-5 py-2.5 text-ink-400 text-xs capitalize">{acc.subtype.replace("_", " ")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
