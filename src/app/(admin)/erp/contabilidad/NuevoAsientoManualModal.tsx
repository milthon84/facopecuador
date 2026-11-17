"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, PlusCircle, Trash2, Scale, AlertCircle, CheckCircle2, ChevronDown, Search, X, Zap } from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { createManualJournalEntryAction, type ManualJournalLineItem } from "./actions";

export interface AccountOption {
  code: string;
  name: string;
  type?: string;
}

interface Props {
  accounts: AccountOption[];
  closedMonths: string[];
  closedYears: number[];
  defaultDate?: string;
  canEdit: boolean;
}

interface FormLine {
  id: string;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
  description: string;
}

function r2(val: number): number {
  return Math.round(val * 100) / 100;
}

function fmt(n: number): string {
  return n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NuevoAsientoManualModal({
  accounts,
  closedMonths,
  closedYears,
  defaultDate,
  canEdit,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [entryDate, setEntryDate] = useState<string>(defaultDate || todayStr);
  const [description, setDescription] = useState<string>("");
  const [reference, setReference] = useState<string>("");

  const [lines, setLines] = useState<FormLine[]>([
    { id: "1", account_code: "", account_name: "", debit: "", credit: "", description: "" },
    { id: "2", account_code: "", account_name: "", debit: "", credit: "", description: "" },
  ]);

  // Validar si el mes o año está cerrado contablemente
  const isPeriodClosed = useMemo(() => {
    if (!entryDate) return false;
    const period = entryDate.slice(0, 7);
    const year = Number(entryDate.slice(0, 4));
    return closedMonths.includes(period) || closedYears.includes(year);
  }, [entryDate, closedMonths, closedYears]);

  // Cálculos de Debe y Haber
  const { totalDebit, totalCredit, diff, isBalanced, neededSide } = useMemo(() => {
    let dSum = 0;
    let cSum = 0;
    for (const l of lines) {
      const d = parseFloat(l.debit) || 0;
      const c = parseFloat(l.credit) || 0;
      if (d > 0) dSum += d;
      if (c > 0) cSum += c;
    }
    const totDeb = r2(dSum);
    const totCred = r2(cSum);
    const dVal = r2(Math.abs(totDeb - totCred));
    return {
      totalDebit: totDeb,
      totalCredit: totCred,
      diff: dVal,
      isBalanced: dVal === 0 && totDeb > 0,
      neededSide: totDeb > totCred ? "credit" : totCred > totDeb ? "debit" : null,
    };
  }, [lines]);

  function handleOpen() {
    setError(null);
    setDescription("");
    setReference("");
    setEntryDate(defaultDate || todayStr);
    setLines([
      { id: "1", account_code: "", account_name: "", debit: "", credit: "", description: "" },
      { id: "2", account_code: "", account_name: "", debit: "", credit: "", description: "" },
    ]);
    setIsOpen(true);
  }

  function handleAddLine() {
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        account_code: "",
        account_name: "",
        debit: "",
        credit: "",
        description: "",
      },
    ]);
  }

  function handleRemoveLine(index: number) {
    if (lines.length <= 2) {
      setLines((prev) =>
        prev.map((l, i) =>
          i === index ? { ...l, account_code: "", account_name: "", debit: "", credit: "", description: "" } : l
        )
      );
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLineChange(index: number, field: keyof FormLine, value: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;

        const updated = { ...l, [field]: value };
        if (field === "debit" && parseFloat(value) > 0) {
          updated.credit = "";
        } else if (field === "credit" && parseFloat(value) > 0) {
          updated.debit = "";
        }
        return updated;
      })
    );
  }

  function handleSelectAccount(index: number, acc: AccountOption | null) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, account_code: acc ? acc.code : "", account_name: acc ? acc.name : "" }
          : l
      )
    );
  }

  // Auto-cuadrar la diferencia en una línea existente o en una nueva
  function handleBalanceOnLine(targetIndex?: number) {
    const dSum = lines.reduce((s, l, i) => s + (i === targetIndex ? 0 : parseFloat(l.debit) || 0), 0);
    const cSum = lines.reduce((s, l, i) => s + (i === targetIndex ? 0 : parseFloat(l.credit) || 0), 0);
    const needed = r2(dSum - cSum);

    if (targetIndex !== undefined && lines[targetIndex]) {
      setLines((prev) =>
        prev.map((l, i) => {
          if (i !== targetIndex) return l;
          if (needed > 0) {
            return { ...l, debit: "", credit: needed.toFixed(2) };
          } else if (needed < 0) {
            return { ...l, debit: Math.abs(needed).toFixed(2), credit: "" };
          }
          return l;
        })
      );
    } else {
      // Buscar primera línea vacía o agregar una nueva
      const emptyIdx = lines.findIndex((l) => !l.debit && !l.credit);
      if (emptyIdx !== -1) {
        handleBalanceOnLine(emptyIdx);
      } else {
        setLines((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            account_code: "",
            account_name: "",
            debit: needed < 0 ? Math.abs(needed).toFixed(2) : "",
            credit: needed > 0 ? needed.toFixed(2) : "",
            description: "",
          },
        ]);
      }
    }
  }

  async function handleSubmit() {
    setError(null);

    if (isPeriodClosed) {
      setError("El período contable seleccionado está cerrado. No es posible registrar asientos.");
      return;
    }

    if (!description.trim()) {
      setError("Debe especificar la glosa o concepto general del asiento.");
      return;
    }

    const validLines: ManualJournalLineItem[] = lines
      .map((l) => ({
        account_code: l.account_code.trim(),
        account_name: l.account_name.trim(),
        debit: r2(parseFloat(l.debit) || 0),
        credit: r2(parseFloat(l.credit) || 0),
        description: l.description.trim() || undefined,
      }))
      .filter((l) => l.account_code && (l.debit > 0 || l.credit > 0));

    if (validLines.length < 2) {
      setError("El asiento debe tener al menos dos líneas con cuentas seleccionadas y montos válidos.");
      return;
    }

    if (!isBalanced) {
      setError(`El asiento está descuadrado por $${fmt(diff)}. El Débito debe ser exactamente igual al Crédito.`);
      return;
    }

    setLoading(true);
    try {
      const res = await createManualJournalEntryAction({
        entry_date: entryDate,
        description: description.trim(),
        reference: reference.trim() || undefined,
        lines: validLines,
      });

      if (!res.success) {
        setError(res.error || "Error al registrar el asiento.");
        setLoading(false);
        return;
      }

      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || "Error al procesar el asiento.");
    } finally {
      setLoading(false);
    }
  }

  if (!canEdit) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 bg-lilac-600 hover:bg-lilac-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
      >
        <PlusCircle size={15} />
        <span>Nuevo Asiento Manual</span>
      </button>

      <StandardModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Nuevo Asiento Contable Manual / Ajuste"
        subtitle="Registro de partida doble NIIF, provisiones, reclasificaciones y ajustes contables"
        icon={<Scale size={18} />}
        maxWidth="max-w-5xl"
        loading={loading}
        loadingText="Guardando y contabilizando asiento..."
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs text-ink-600">
                Débito: <strong className="font-mono text-emerald-700 font-bold">${fmt(totalDebit)}</strong>
              </span>
              <span className="text-ink-300">·</span>
              <span className="text-xs text-ink-600">
                Crédito: <strong className="font-mono text-blue-700 font-bold">${fmt(totalCredit)}</strong>
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                  isBalanced
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {isBalanced ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>✓ Cuadrado</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} className="text-red-500" />
                    <span>Descuadre: ${fmt(diff)}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={loading}
                className="px-3.5 py-1.5 text-xs font-semibold text-ink-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isBalanced || isPeriodClosed || !description.trim()}
                className="px-4 py-1.5 text-xs font-bold bg-lilac-600 hover:bg-lilac-700 disabled:opacity-40 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Guardar Asiento</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5 text-ink-900">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-red-800 animate-in fade-in">
              <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Error: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {isPeriodClosed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-900 animate-in fade-in">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Período contable cerrado: </span>
                <span>
                  La fecha seleccionada ({entryDate}) pertenece a un período ya cerrado. Cambia la fecha a un mes
                  abierto para continuar.
                </span>
              </div>
            </div>
          )}

          {/* ── Encabezado Compacto y Elegante en 1 Sola Barra / Grid ── */}
          <div className="bg-lilac-50/40 border border-lilac-100/90 rounded-xl p-3 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
              {/* Fecha Contable */}
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                  Fecha Contable *
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full text-xs font-mono font-medium border border-lilac-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 transition"
                />
              </div>

              {/* Documento de Soporte */}
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                  Doc. Soporte / Ref. <span className="font-normal text-ink-400 lowercase">(opc)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ej: Chq #450, Memo #12"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-xs border border-lilac-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 transition"
                />
              </div>

              {/* Glosa / Concepto General */}
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
                  Glosa / Concepto General del Asiento *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Reclasificación banco, Provisión honorarios, Ajuste fin de mes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs border border-lilac-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-lilac-400 transition"
                />
              </div>
            </div>
          </div>

          {/* ── Tabla Contable Estilo Libro Diario (Compacta, Intuitiva, Elegante) ── */}
          <div className="border border-lilac-100 rounded-xl overflow-hidden shadow-2xs bg-white">
            {/* Barra de título de la tabla */}
            <div className="bg-lilac-50/70 border-b border-lilac-100 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-800">Partida Doble (Cuentas y Líneas)</span>
                <span className="text-[10px] font-semibold bg-white border border-lilac-200 text-lilac-700 px-2 py-0.2 rounded-full">
                  {lines.length} {lines.length === 1 ? "línea" : "líneas"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-[11px] font-bold text-lilac-700 hover:text-lilac-900 bg-white hover:bg-lilac-50 border border-lilac-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <Plus size={13} className="text-lilac-600" />
                <span>Agregar Cuenta / Línea</span>
              </button>
            </div>

            {/* Cabecera oficial de columnas (Siempre visible en desktop y móvil) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase font-bold text-ink-500 tracking-wider">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2.5 w-[38%]">Cuenta Contable</th>
                    <th className="py-2 px-2.5 w-[28%]">Detalle / Glosa Línea</th>
                    <th className="py-2 px-2.5 text-right w-[16%]">Débito (Debe)</th>
                    <th className="py-2 px-2.5 text-right w-[16%]">Crédito (Haber)</th>
                    <th className="py-2 px-1.5 text-center w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {lines.map((line, idx) => {
                    const hasDebit = parseFloat(line.debit) > 0;
                    const hasCredit = parseFloat(line.credit) > 0;
                    const isEmpty = !line.debit && !line.credit;

                    return (
                      <tr key={line.id} className="hover:bg-lilac-50/20 transition-colors group">
                        {/* Índice # */}
                        <td className="py-1.5 px-2 text-center text-[10px] font-mono text-ink-400 select-none">
                          <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center mx-auto font-bold text-ink-600">
                            {idx + 1}
                          </span>
                        </td>

                        {/* Cuenta Contable Buscable */}
                        <td className="py-1.5 px-2.5">
                          <AccountCombobox
                            accounts={accounts}
                            selectedCode={line.account_code}
                            selectedName={line.account_name}
                            onSelect={(acc) => handleSelectAccount(idx, acc)}
                          />
                        </td>

                        {/* Detalle / Glosa individual */}
                        <td className="py-1.5 px-2.5">
                          <input
                            type="text"
                            placeholder="Detalle opcional..."
                            value={line.description}
                            onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-lilac-400 placeholder:text-gray-300 transition"
                          />
                        </td>

                        {/* Débito ($) */}
                        <td className="py-1.5 px-2.5 text-right">
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[11px] font-mono text-gray-400 pointer-events-none">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={line.debit}
                              onChange={(e) => handleLineChange(idx, "debit", e.target.value)}
                              className={`w-full text-xs font-mono font-bold text-right pl-5 pr-2 py-1.5 rounded-lg border transition ${
                                hasDebit
                                  ? "bg-emerald-50/40 border-emerald-300 text-emerald-800 focus:ring-1 focus:ring-emerald-500"
                                  : "border-gray-200 text-ink-800 placeholder:text-gray-300 focus:ring-1 focus:ring-lilac-400"
                              }`}
                            />
                          </div>
                        </td>

                        {/* Crédito ($) */}
                        <td className="py-1.5 px-2.5 text-right">
                          <div className="relative flex items-center">
                            <span className="absolute left-2 text-[11px] font-mono text-gray-400 pointer-events-none">
                              $
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={line.credit}
                              onChange={(e) => handleLineChange(idx, "credit", e.target.value)}
                              className={`w-full text-xs font-mono font-bold text-right pl-5 pr-2 py-1.5 rounded-lg border transition ${
                                hasCredit
                                  ? "bg-blue-50/40 border-blue-300 text-blue-800 focus:ring-1 focus:ring-blue-500"
                                  : "border-gray-200 text-ink-800 placeholder:text-gray-300 focus:ring-1 focus:ring-lilac-400"
                              }`}
                            />
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-1.5 px-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {diff > 0 && isEmpty && (
                              <button
                                type="button"
                                onClick={() => handleBalanceOnLine(idx)}
                                title={`Rellenar $${fmt(diff)} en esta línea para cuadrar`}
                                className="w-6 h-6 rounded-md bg-lilac-100 hover:bg-lilac-200 text-lilac-800 flex items-center justify-center transition cursor-pointer"
                              >
                                <Zap size={11} className="fill-lilac-700" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              title={lines.length > 2 ? "Eliminar línea" : "Limpiar línea"}
                              className="w-6 h-6 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* ── Pie de Tabla con Totales Alineados ── */}
                <tfoot>
                  <tr className="bg-gray-50/90 border-t-2 border-lilac-100 font-mono text-xs">
                    <td colSpan={3} className="py-2.5 px-3 font-sans">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase text-ink-500">Totales Contables:</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isBalanced
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-red-50 text-red-800 border-red-200"
                            }`}
                          >
                            {isBalanced ? "✓ Balance Cuadrado" : `Descuadre: $${fmt(diff)}`}
                          </span>
                        </div>

                        {diff > 0 && (
                          <button
                            type="button"
                            onClick={() => handleBalanceOnLine()}
                            className="text-[10px] font-bold text-lilac-700 hover:text-lilac-900 bg-lilac-100 hover:bg-lilac-200 px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer"
                          >
                            <Zap size={11} className="fill-lilac-700" />
                            <span>Cuadrar diferencia (${fmt(diff)})</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Total Débito */}
                    <td className="py-2.5 px-2.5 text-right font-bold text-emerald-700 border-l border-gray-100">
                      ${fmt(totalDebit)}
                    </td>

                    {/* Total Crédito */}
                    <td className="py-2.5 px-2.5 text-right font-bold text-blue-700 border-l border-gray-100">
                      ${fmt(totalCredit)}
                    </td>

                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </StandardModal>
    </>
  );
}

// ── Combobox buscador de cuentas (Compacto, con Clear y Tag de Tipo) ────────
function AccountCombobox({
  accounts,
  selectedCode,
  selectedName,
  onSelect,
}: {
  accounts: AccountOption[];
  selectedCode: string;
  selectedName: string;
  onSelect: (acc: AccountOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return accounts.slice(0, 40);
    const q = query.toLowerCase().trim();
    return accounts
      .filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [accounts, query]);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`w-full flex items-center justify-between gap-1 text-xs rounded-lg px-2 py-1.5 border bg-white transition ${
          selectedCode
            ? "border-lilac-200 text-ink-900 hover:border-lilac-300"
            : "border-gray-200 text-ink-400 hover:border-gray-300"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setOpen((p) => !p);
            setQuery("");
          }}
          className="flex-1 text-left truncate flex items-center gap-1.5 cursor-pointer focus:outline-none"
        >
          {selectedCode ? (
            <>
              <span className="font-mono text-[11px] font-bold text-lilac-800 bg-lilac-50 px-1.5 py-0.2 rounded border border-lilac-100 shrink-0">
                {selectedCode}
              </span>
              <span className="truncate font-medium text-ink-800 text-xs">{selectedName}</span>
            </>
          ) : (
            <span className="text-gray-400 text-xs italic">Seleccionar cuenta contable...</span>
          )}
        </button>

        <div className="flex items-center gap-0.5 shrink-0">
          {selectedCode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              title="Quitar cuenta seleccionada"
              className="text-gray-300 hover:text-red-500 p-0.5 rounded transition"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen((p) => !p);
              setQuery("");
            }}
            className="text-ink-400 p-0.5"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[320px] max-w-md bg-white border border-lilac-100 rounded-xl shadow-2xl z-[100] p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-ink-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar por código (ej: 1.1) o nombre (ej: Banco)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-lilac-500"
            />
          </div>

          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs text-ink-400">No se encontraron cuentas con ese criterio.</p>
            ) : (
              filtered.map((acc) => (
                <button
                  key={acc.code}
                  type="button"
                  onClick={() => {
                    onSelect(acc);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-lilac-50 rounded-md transition flex items-center justify-between cursor-pointer ${
                    selectedCode === acc.code ? "bg-lilac-50/80 font-bold text-lilac-800" : "text-ink-800"
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="font-mono text-ink-500 mr-1.5 text-[11px] font-semibold">{acc.code}</span>
                    <span>{acc.name}</span>
                  </div>
                  {acc.type && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded uppercase tracking-wider bg-gray-100 text-ink-500 font-semibold shrink-0">
                      {acc.type}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
