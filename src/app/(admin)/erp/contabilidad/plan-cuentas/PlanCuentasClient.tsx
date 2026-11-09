"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Search,
  Folder,
  FileText,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ArrowLeft,
  Filter,
  Layers,
  Check,
} from "lucide-react";
import Link from "next/link";
import {
  AccountFormData,
  saveAccountAction,
  deleteAccountAction,
  toggleAccountActiveAction,
} from "./actions";

type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parent_code?: string | null;
  is_movement?: boolean;
  active?: boolean;
};

const ACCOUNT_TYPES = [
  { value: "ACTIVO", label: "Activo (1)", prefix: "1" },
  { value: "PASIVO", label: "Pasivo (2)", prefix: "2" },
  { value: "PATRIMONIO", label: "Patrimonio (3)", prefix: "3" },
  { value: "INGRESO", label: "Ingreso (4)", prefix: "4" },
  { value: "GASTO", label: "Gasto (5)", prefix: "5" },
  { value: "COSTO", label: "Costo (6)", prefix: "6" },
];

const COMMON_SUBTYPES: Record<string, { value: string; label: string }[]> = {
  ACTIVO: [
    { value: "corriente", label: "Activo Corriente" },
    { value: "no_corriente", label: "Activo No Corriente (Fijo)" },
    { value: "grupo", label: "Grupo / Agrupadora" },
    { value: "otro", label: "Otro" },
  ],
  PASIVO: [
    { value: "corriente", label: "Pasivo Corriente (Corto Plazo)" },
    { value: "no_corriente", label: "Pasivo No Corriente (Largo Plazo)" },
    { value: "grupo", label: "Grupo / Agrupadora" },
    { value: "otro", label: "Otro" },
  ],
  PATRIMONIO: [
    { value: "capital", label: "Capital Social" },
    { value: "reservas", label: "Reservas" },
    { value: "resultados", label: "Resultados Acumulados / Ejercicio" },
    { value: "grupo", label: "Grupo / Agrupadora" },
  ],
  INGRESO: [
    { value: "operacional", label: "Ingreso Operacional" },
    { value: "no_operacional", label: "Ingreso No Operacional / Financiero" },
    { value: "grupo", label: "Grupo / Agrupadora" },
  ],
  GASTO: [
    { value: "administrativo", label: "Gasto Administrativo" },
    { value: "operacional", label: "Gasto Operacional / Clínica" },
    { value: "ventas", label: "Gasto de Ventas y Publicidad" },
    { value: "financiero", label: "Gasto Financiero" },
    { value: "no_operacional", label: "Gasto No Operacional / Otros" },
    { value: "grupo", label: "Grupo / Agrupadora" },
  ],
  COSTO: [
    { value: "costo_ventas", label: "Costo de Ventas y Producción" },
    { value: "costo_servicios", label: "Costo de Servicios Clínicos" },
    { value: "grupo", label: "Grupo / Agrupadora" },
  ],
};

function inferAccountType(code: string): string {
  const first = code.trim().charAt(0);
  switch (first) {
    case "1": return "ACTIVO";
    case "2": return "PASIVO";
    case "3": return "PATRIMONIO";
    case "4": return "INGRESO";
    case "5": return "GASTO";
    case "6": return "COSTO";
    default: return "GASTO";
  }
}

function inferParentCode(code: string): string {
  const clean = code.trim();
  if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts.length > 1) {
      return parts.slice(0, -1).join(".");
    }
  }
  return "";
}

function getIndentationLevel(code: string): number {
  const dotCount = (code.match(/\./g) || []).length;
  return Math.min(dotCount, 4);
}

export default function PlanCuentasClient({
  initialAccounts,
  canEdit = false,
}: {
  initialAccounts: Account[];
  canEdit?: boolean;
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("TODOS");
  const [levelFilter, setLevelFilter] = useState<"TODOS" | "GRUPOS" | "MOVIMIENTO">("TODOS");
  const [statusFilter, setStatusFilter] = useState<"ACTIVAS" | "TODAS" | "INACTIVAS">("ACTIVAS");

  // Estado para el modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Formulario dentro del modal
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("GASTO");
  const [formSubtype, setFormSubtype] = useState("administrativo");
  const [formParentCode, setFormParentCode] = useState("");
  const [formIsMovement, setFormIsMovement] = useState(true);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado de confirmación de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Mensaje flotante de feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }

  // Grupos existentes para autocompletar parent_code
  const existingGroups = useMemo(() => {
    return accounts
      .filter((a) => a.is_movement === false || a.subtype === "grupo" || !a.code.includes(".") || (a.code.match(/\./g) || []).length <= 2)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts]);

  // Contadores
  const stats = useMemo(() => {
    const total = accounts.length;
    const groupsCount = accounts.filter((a) => a.is_movement === false || a.subtype === "grupo").length;
    const movementCount = accounts.filter((a) => a.is_movement !== false && a.subtype !== "grupo").length;
    const inactiveCount = accounts.filter((a) => a.active === false).length;
    return { total, groupsCount, movementCount, inactiveCount };
  }, [accounts]);

  // Filtrado de cuentas
  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      // Filtro de búsqueda
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchCode = a.code.toLowerCase().includes(q);
        const matchName = a.name.toLowerCase().includes(q);
        if (!matchCode && !matchName) return false;
      }

      // Filtro por tipo
      if (typeFilter !== "TODOS" && a.type?.toUpperCase() !== typeFilter) {
        return false;
      }

      // Filtro por nivel (Grupo vs Movimiento)
      const isGrp = a.is_movement === false || a.subtype === "grupo";
      if (levelFilter === "GRUPOS" && !isGrp) return false;
      if (levelFilter === "MOVIMIENTO" && isGrp) return false;

      // Filtro por estado
      if (statusFilter === "ACTIVAS" && a.active === false) return false;
      if (statusFilter === "INACTIVAS" && a.active !== false) return false;

      return true;
    });
  }, [accounts, search, typeFilter, levelFilter, statusFilter]);

  // Abrir modal para crear nueva cuenta
  function handleOpenCreate(defaultParent?: Account) {
    setEditingAccount(null);
    setFormError(null);

    if (defaultParent) {
      // Sugerir subcuenta del grupo seleccionado
      const parentCode = defaultParent.code;
      setFormParentCode(parentCode);
      setFormType(defaultParent.type || inferAccountType(parentCode));
      setFormIsMovement(true);
      setFormActive(true);

      // Calcular siguiente secuencial sugerido
      const children = accounts.filter((a) => a.parent_code === parentCode || (a.code.startsWith(parentCode + ".") && (a.code.match(/\./g) || []).length === (parentCode.match(/\./g) || []).length + 1));
      let nextSeq = 1;
      if (children.length > 0) {
        const lastCodes = children.map((c) => {
          const parts = c.code.split(".");
          return parseInt(parts[parts.length - 1], 10) || 0;
        });
        nextSeq = Math.max(...lastCodes) + 1;
      }
      const seqStr = nextSeq < 10 ? `0${nextSeq}` : `${nextSeq}`;
      setFormCode(`${parentCode}.${seqStr}`);
      setFormName("");
      setFormSubtype(defaultParent.subtype || "operacional");
    } else {
      setFormCode("");
      setFormName("");
      setFormType("GASTO");
      setFormSubtype("administrativo");
      setFormParentCode("");
      setFormIsMovement(true);
      setFormActive(true);
    }

    setIsModalOpen(true);
  }

  // Abrir modal para editar cuenta existente
  function handleOpenEdit(acc: Account) {
    setEditingAccount(acc);
    setFormError(null);
    setFormCode(acc.code);
    setFormName(acc.name);
    setFormType(acc.type || inferAccountType(acc.code));
    setFormSubtype(acc.subtype || "operacional");
    setFormParentCode(acc.parent_code || inferParentCode(acc.code));
    setFormIsMovement(acc.is_movement !== false && acc.subtype !== "grupo");
    setFormActive(acc.active !== false);
    setIsModalOpen(true);
  }

  // Al cambiar el código en el formulario
  function handleCodeChange(newCode: string) {
    setFormCode(newCode);
    if (!editingAccount) {
      const detectedType = inferAccountType(newCode);
      setFormType(detectedType);
      const suggestedParent = inferParentCode(newCode);
      if (suggestedParent && !formParentCode) {
        setFormParentCode(suggestedParent);
      }
    }
  }

  // Guardar cuenta (Crear o Actualizar)
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const cleanCode = formCode.trim();
    const cleanName = formName.trim();

    if (!cleanCode) {
      setFormError("Por favor ingresa el código contable.");
      return;
    }
    if (!cleanName) {
      setFormError("Por favor ingresa el nombre de la cuenta.");
      return;
    }

    const payload: AccountFormData = {
      id: editingAccount?.id,
      code: cleanCode,
      name: cleanName,
      type: formType,
      subtype: formSubtype || null,
      parent_code: formParentCode.trim() || null,
      is_movement: formIsMovement,
      active: formActive,
    };

    startTransition(async () => {
      try {
        const res = await saveAccountAction(payload);
        if (res.success && res.account) {
          showToast(
            editingAccount
              ? `Cuenta "${cleanCode} — ${cleanName}" actualizada correctamente.`
              : `Cuenta "${cleanCode} — ${cleanName}" creada exitosamente.`
          );

          // Actualizar estado local
          setAccounts((prev) => {
            if (editingAccount) {
              return prev
                .map((a) => (a.id === editingAccount.id ? (res.account as Account) : a))
                .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
            } else {
              return [...prev, res.account as Account].sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { numeric: true })
              );
            }
          });

          setIsModalOpen(false);
        } else {
          setFormError(res.error || "Ocurrió un error al guardar la cuenta.");
        }
      } catch (err: any) {
        setFormError(err.message || "Error al procesar la solicitud.");
      }
    });
  }

  // Activar o desactivar cuenta
  async function handleToggleActive(acc: Account) {
    const nextState = acc.active === false;
    startTransition(async () => {
      try {
        const res = await toggleAccountActiveAction(acc.id, nextState);
        if (res.success) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === acc.id ? { ...a, active: nextState } : a))
          );
          showToast(
            nextState
              ? `Cuenta "${acc.code}" activada.`
              : `Cuenta "${acc.code}" desactivada.`
          );
        } else {
          showToast(res.error || "No se pudo cambiar el estado.", "error");
        }
      } catch (err: any) {
        showToast(err.message || "Error al actualizar estado.", "error");
      }
    });
  }

  // Eliminar cuenta
  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const res = await deleteAccountAction(id);
        if (res.success) {
          const removed = accounts.find((a) => a.id === id);
          setAccounts((prev) => prev.filter((a) => a.id !== id));
          setDeletingId(null);
          showToast(`Cuenta "${removed?.code || ""}" eliminada exitosamente.`);
        } else {
          setDeletingId(null);
          showToast(res.error || "No se pudo eliminar la cuenta.", "error");
        }
      } catch (err: any) {
        setDeletingId(null);
        showToast(err.message || "Error al eliminar la cuenta.", "error");
      }
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      {/* Toast flotante */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold border backdrop-blur-md transition-all animate-bounceIn ${
            toastMessage.type === "success"
              ? "bg-teal-900/90 text-white border-teal-700 shadow-teal-900/20"
              : "bg-red-900/90 text-white border-red-700 shadow-red-900/20"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 size={16} className="text-teal-300 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-300 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-lilac-100 text-lilac-700">
              <Layers size={18} />
            </span>
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">Plan de Cuentas NIIF</h1>
          </div>
          <p className="text-xs text-ink-500 mt-1">
            Catálogo maestro de cuentas contables, grupos acumuladores y cuentas de movimiento operativo.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/erp/contabilidad"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-lilac-200 text-xs font-semibold text-ink-600 hover:bg-lilac-50 transition shadow-2xs"
          >
            <ArrowLeft size={14} /> Volver a Contabilidad
          </Link>

          {canEdit && (
            <button
              type="button"
              onClick={() => handleOpenCreate()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold shadow-md shadow-lilac-200 transition active:scale-[0.98]"
            >
              <Plus size={15} />
              <span>Nueva Cuenta / Grupo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen Rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-lilac-100 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-ink-500 text-[11px] font-bold uppercase tracking-wide">
            <span>Total Cuentas</span>
            <Layers size={14} className="text-lilac-500" />
          </div>
          <div className="text-xl font-extrabold text-ink-900 mt-1 font-mono">
            {stats.total}
          </div>
          <div className="text-[10px] text-ink-400 mt-0.5">Estructura NIIF Ecuador</div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-blue-700 text-[11px] font-bold uppercase tracking-wide">
            <span>Grupos / Títulos</span>
            <Folder size={14} className="text-blue-500" />
          </div>
          <div className="text-xl font-extrabold text-blue-900 mt-1 font-mono">
            {stats.groupsCount}
          </div>
          <div className="text-[10px] text-blue-500/80 mt-0.5">Acumulan saldos contables</div>
        </div>

        <div className="bg-white border border-teal-100 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-teal-700 text-[11px] font-bold uppercase tracking-wide">
            <span>Cuentas de Movimiento</span>
            <FileText size={14} className="text-teal-500" />
          </div>
          <div className="text-xl font-extrabold text-teal-900 mt-1 font-mono">
            {stats.movementCount}
          </div>
          <div className="text-[10px] text-teal-600 mt-0.5">Reciben asientos y débitos/créditos</div>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-[11px] font-bold uppercase tracking-wide">
            <span>Inactivas</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-900 mt-1 font-mono">
            {stats.inactiveCount}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Deshabilitadas para nuevas operaciones</div>
        </div>
      </div>

      {/* Contenedor Principal: Filtros y Tabla */}
      <div className="bg-white border border-lilac-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Barra de Filtros y Búsqueda */}
        <div className="p-4 border-b border-lilac-100 bg-lilac-50/30 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Buscador */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por código (ej. 2.1.05) o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-lilac-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-lilac-400 focus:ring-2 focus:ring-lilac-100 bg-white transition-all shadow-2xs text-ink-900"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selector de Nivel */}
            <div className="flex items-center gap-1 bg-lilac-100/60 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setLevelFilter("TODOS")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  levelFilter === "TODOS"
                    ? "bg-white text-ink-900 shadow-2xs font-bold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                Todos ({accounts.length})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("GRUPOS")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  levelFilter === "GRUPOS"
                    ? "bg-white text-blue-900 shadow-2xs font-bold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <Folder size={12} className="text-blue-600" />
                Grupos
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("MOVIMIENTO")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                  levelFilter === "MOVIMIENTO"
                    ? "bg-white text-teal-900 shadow-2xs font-bold"
                    : "text-ink-600 hover:text-ink-900"
                }`}
              >
                <FileText size={12} className="text-teal-600" />
                Movimiento
              </button>
            </div>
          </div>

          {/* Filtros secundarios: Tipo contable y estado */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-lilac-100/60">
            {/* Botones por tipo contable */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <span className="text-[11px] font-bold text-ink-400 uppercase tracking-wide mr-1 flex items-center gap-1 shrink-0">
                <Filter size={11} /> Tipo:
              </span>
              {[
                { value: "TODOS", label: "Todos" },
                { value: "ACTIVO", label: "Activo (1)" },
                { value: "PASIVO", label: "Pasivo (2)" },
                { value: "PATRIMONIO", label: "Patrimonio (3)" },
                { value: "INGRESO", label: "Ingresos (4)" },
                { value: "GASTO", label: "Gastos (5)" },
                { value: "COSTO", label: "Costos (6)" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTypeFilter(t.value)}
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                    typeFilter === t.value
                      ? "bg-lilac-600 text-white font-bold shadow-2xs"
                      : "bg-white border border-lilac-200 text-ink-600 hover:bg-lilac-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filtro por estado activo / inactivo */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-ink-400 font-semibold mr-1">Estado:</span>
              {(["ACTIVAS", "TODAS", "INACTIVAS"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition uppercase ${
                    statusFilter === st
                      ? "bg-ink-800 text-white"
                      : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  {st === "ACTIVAS" ? "Solo Activas" : st === "INACTIVAS" ? "Inactivas" : "Todas"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabla de Cuentas */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-lilac-50/70 text-ink-600 text-[11px] font-bold uppercase tracking-wider border-b border-lilac-100">
              <tr>
                <th className="px-4 py-3 w-36">Código</th>
                <th className="px-4 py-3">Nombre de la Cuenta / Grupo</th>
                <th className="px-3 py-3 w-28 text-center">Nivel</th>
                <th className="px-3 py-3 w-28">Tipo</th>
                <th className="px-3 py-3 w-32">Subtipo</th>
                <th className="px-3 py-3 w-24 text-center">Estado</th>
                {canEdit && <th className="px-4 py-3 w-28 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-lilac-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="py-12 text-center text-ink-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search size={28} className="text-ink-300" />
                      <p className="text-sm font-medium">No se encontraron cuentas con los filtros seleccionados.</p>
                      {search && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setTypeFilter("TODOS");
                            setLevelFilter("TODOS");
                          }}
                          className="text-xs text-lilac-600 font-bold hover:underline"
                        >
                          Limpiar filtros de búsqueda
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => {
                  const isGroup = acc.is_movement === false || acc.subtype === "grupo";
                  const indentLevel = getIndentationLevel(acc.code);
                  const isInactive = acc.active === false;

                  return (
                    <tr
                      key={acc.id}
                      className={`transition-colors group ${
                        isInactive
                          ? "bg-gray-50/60 opacity-60 hover:opacity-100"
                          : isGroup
                          ? indentLevel <= 1
                            ? "bg-lilac-100/40 font-bold hover:bg-lilac-100/60"
                            : "bg-blue-50/30 font-semibold hover:bg-blue-50/60"
                          : "hover:bg-lilac-50/30 text-ink-800"
                      }`}
                    >
                      {/* Código con indentación */}
                      <td className="px-4 py-2.5 font-mono text-xs text-ink-700 whitespace-nowrap">
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: `${indentLevel * 14}px` }}
                        >
                          {indentLevel > 0 && (
                            <span className="text-ink-300 select-none">└</span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              isGroup
                                ? "bg-lilac-200/60 text-lilac-950 font-bold"
                                : "text-ink-700"
                            }`}
                          >
                            {acc.code}
                          </span>
                        </div>
                      </td>

                      {/* Nombre con ícono */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isGroup ? (
                            <Folder size={15} className="text-lilac-600 shrink-0" />
                          ) : (
                            <FileText size={14} className="text-teal-600 shrink-0" />
                          )}
                          <span
                            className={`text-xs ${
                              isGroup
                                ? "text-ink-950 font-bold"
                                : "text-ink-900 font-medium"
                            }`}
                          >
                            {acc.name}
                          </span>
                          {acc.parent_code && (
                            <span className="text-[10px] text-ink-400 font-mono hidden md:inline-block">
                              (de {acc.parent_code})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nivel: Grupo o Movimiento */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {isGroup ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            GRUPO
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            MOVIMIENTO
                          </span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="px-3 py-2.5 text-xs font-semibold text-ink-600 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                            acc.type === "ACTIVO"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : acc.type === "PASIVO"
                              ? "bg-rose-50 text-rose-800 border border-rose-200"
                              : acc.type === "PATRIMONIO"
                              ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                              : acc.type === "INGRESO"
                              ? "bg-teal-50 text-teal-800 border border-teal-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {acc.type}
                        </span>
                      </td>

                      {/* Subtipo */}
                      <td className="px-3 py-2.5 text-[11px] text-ink-500 capitalize whitespace-nowrap">
                        {acc.subtype ? acc.subtype.replace("_", " ") : "—"}
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {acc.active !== false ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            Inactiva
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      {canEdit && (
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                            {/* Si es grupo, botón rápido para crear una subcuenta dentro de este grupo */}
                            {isGroup && (
                              <button
                                type="button"
                                onClick={() => handleOpenCreate(acc)}
                                title="Agregar subcuenta a este grupo"
                                className="p-1 rounded-lg text-lilac-600 hover:bg-lilac-100 hover:text-lilac-800 transition"
                              >
                                <Plus size={14} />
                              </button>
                            )}

                            {/* Botón Editar */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(acc)}
                              title="Modificar cuenta o grupo"
                              className="p-1 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition"
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Botón Activar / Desactivar */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(acc)}
                              title={acc.active !== false ? "Desactivar cuenta" : "Activar cuenta"}
                              className={`p-1 rounded-lg transition ${
                                acc.active !== false
                                  ? "text-emerald-600 hover:bg-emerald-50"
                                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              }`}
                            >
                              <Check size={13} />
                            </button>

                            {/* Botón Eliminar con confirmación */}
                            {deletingId === acc.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleDelete(acc.id)}
                                  className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 px-1.5 py-0.5 rounded"
                                >
                                  {isPending ? "..." : "Sí"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(null)}
                                  className="text-[10px] font-bold text-gray-600 hover:bg-gray-200 px-1 rounded"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingId(acc.id)}
                                title="Eliminar cuenta"
                                className="p-1 rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DE CREACIÓN / EDICIÓN DE CUENTA O GRUPO ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-lilac-200 animate-scaleIn my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Modal */}
            <div className="px-5 py-4 border-b border-lilac-100 flex items-center justify-between bg-lilac-50/50">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-lilac-600 text-white shadow-xs">
                  {editingAccount ? <Edit2 size={16} /> : <Plus size={16} />}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">
                    {editingAccount ? "Modificar Cuenta / Grupo Contable" : "Crear Nueva Cuenta / Grupo Contable"}
                  </h3>
                  <p className="text-[11px] text-ink-500">
                    {editingAccount
                      ? `ID: ${editingAccount.id.slice(0, 8)} · Código actual: ${editingAccount.code}`
                      : "Defina el código, clasificación y naturaleza según el plan NIIF"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-ink-400 hover:text-ink-700 p-1 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmitForm} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium flex items-start gap-2">
                  <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Selector de Nivel: Grupo vs Movimiento */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink-700 block">
                  Nivel de la Cuenta *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormIsMovement(false)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      !formIsMovement
                        ? "border-lilac-600 bg-lilac-50/80 ring-2 ring-lilac-200 font-bold text-lilac-950"
                        : "border-lilac-200 bg-white text-ink-600 hover:bg-lilac-50/30"
                    }`}
                  >
                    <Folder size={18} className={!formIsMovement ? "text-lilac-600" : "text-ink-400"} />
                    <div>
                      <div className="text-xs">📁 Grupo / Título</div>
                      <div className="text-[10px] font-normal text-ink-500">Agrupa subcuentas (no recibe asientos)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormIsMovement(true)}
                    className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 ${
                      formIsMovement
                        ? "border-teal-600 bg-teal-50/80 ring-2 ring-teal-200 font-bold text-teal-950"
                        : "border-lilac-200 bg-white text-ink-600 hover:bg-teal-50/30"
                    }`}
                  >
                    <FileText size={18} className={formIsMovement ? "text-teal-600" : "text-ink-400"} />
                    <div>
                      <div className="text-xs">📄 Cuenta Movimiento</div>
                      <div className="text-[10px] font-normal text-ink-500">Recibe débitos y créditos directos</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Código y Nombre */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-xs font-bold text-ink-700">
                    Código Contable *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder={formIsMovement ? "Ej. 2.1.05.01" : "Ej. 2.1.05"}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                  />
                  <span className="text-[10px] text-ink-400 block">
                    Nivel jerárquico separado por puntos
                  </span>
                </div>

                <div className="sm:col-span-7 space-y-1">
                  <label className="text-xs font-bold text-ink-700">
                    Nombre de la Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={formIsMovement ? "Préstamos Accionistas por Pagar" : "PRÉSTAMOS ACCIONISTAS"}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                  />
                  <span className="text-[10px] text-ink-400 block">
                    {formIsMovement ? "Formato Tipo Título" : "Recomendado en MAYÚSCULAS para grupos"}
                  </span>
                </div>
              </div>

              {/* Tipo y Subtipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-700">
                    Tipo Principal *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs text-ink-900 font-semibold focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-700">
                    Subtipo / Clasificación
                  </label>
                  <select
                    value={formSubtype}
                    onChange={(e) => setFormSubtype(e.target.value)}
                    className="w-full border border-lilac-200 rounded-xl px-3 py-2 text-xs text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white capitalize"
                  >
                    {(COMMON_SUBTYPES[formType] || COMMON_SUBTYPES.GASTO).map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cuenta Padre (Parent Code) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-ink-700">
                  Cuenta Padre / Grupo Superior (Opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formParentCode}
                    onChange={(e) => setFormParentCode(e.target.value)}
                    placeholder="Ej. 2.1.05"
                    className="flex-1 border border-lilac-200 rounded-xl px-3 py-2 text-xs font-mono text-ink-900 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setFormParentCode(e.target.value);
                    }}
                    value=""
                    className="w-40 border border-lilac-200 rounded-xl px-2 py-2 text-xs text-ink-600 focus:outline-none focus:ring-2 focus:ring-lilac-400 bg-white truncate"
                  >
                    <option value="">— Elegir de lista —</option>
                    {existingGroups
                      .filter((g) => g.type === formType || !g.type)
                      .map((g) => (
                        <option key={g.id} value={g.code}>
                          {g.code} {g.name}
                        </option>
                      ))}
                  </select>
                </div>
                <span className="text-[10px] text-ink-400 block">
                  Permite anidar la jerarquía en los reportes de balance y sumas y saldos.
                </span>
              </div>

              {/* Estado Activo */}
              <div className="pt-2 border-t border-lilac-100 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-ink-900">Estado de la Cuenta</div>
                  <div className="text-[11px] text-ink-500">
                    {formActive
                      ? "Habilitada para seleccionarse en asientos y módulos"
                      : "Deshabilitada para nuevas transacciones"}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lilac-600"></div>
                </label>
              </div>

              {/* Botones de Acción */}
              <div className="pt-3 border-t border-lilac-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-lilac-200 text-xs font-semibold text-ink-600 hover:bg-lilac-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-lilac-600 hover:bg-lilac-700 text-white text-xs font-bold shadow-md shadow-lilac-200 transition active:scale-[0.98] disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>{editingAccount ? "Actualizar Cuenta" : "Crear Cuenta"}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
