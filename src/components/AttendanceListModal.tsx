"use client";

import { useState } from "react";
import { 
  ClipboardList, X, Printer, CheckCircle2, AlertCircle, 
  Loader2, UserCheck, DollarSign, Search, Calendar 
} from "lucide-react";
import { getModuleAttendanceDataAction, updateModuleBillingStatusAction } from "@/app/(admin)/erp/cursos/actions";

interface Props {
  moduleId: string;
  moduleName: string;
  moduleNumber: number;
}

export default function AttendanceListModal({ moduleId, moduleName, moduleNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setErrorMsg(null);

    const res = await getModuleAttendanceDataAction(moduleId);
    if (res.success) {
      setData(res);
    } else {
      setErrorMsg(res.error || "Error al cargar datos de asistencia.");
    }
    setLoading(false);
  }

  async function handleStatusChange(moduloInscripcionId: string, newStatus: string) {
    setUpdatingId(moduloInscripcionId);
    try {
      await updateModuleBillingStatusAction(moduloInscripcionId, newStatus, moduleId);
      setData((prev: any) => ({
        ...prev,
        students: prev.students.map((s: any) => 
          s.moduloInscripcionId === moduloInscripcionId ? { ...s, billingStatus: newStatus } : s
        )
      }));
    } catch (err: any) {
      alert("Error al actualizar estado de pago: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  function handlePrint() {
    window.print();
  }

  const filteredStudents = data?.students?.filter((s: any) => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.documentNumber.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const paidCount = data?.students?.filter((s: any) => s.billingStatus === "invoiced").length || 0;
  const pendingCount = data?.students?.filter((s: any) => s.billingStatus === "pending").length || 0;
  const freeCount = data?.students?.filter((s: any) => s.billingStatus === "free").length || 0;

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-2.5 py-1 text-xs font-semibold text-lilac-700 bg-lilac-50/80 hover:bg-lilac-100/80 border border-lilac-200/80 rounded-lg transition-all flex items-center gap-1.5 shadow-2xs"
        title="Imprimir lista de asistencia y controlar pagos"
      >
        <ClipboardList size={13} className="text-lilac-600" />
        <span>Asistencia & Pagos</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-lilac-100 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-lilac-100 bg-lilac-50/40 flex items-center justify-between no-print">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lilac-600 text-white flex items-center justify-center shadow-xs">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-ink-950 text-base leading-tight">
                    Lista de Asistencia & Control de Pagos
                  </h3>
                  <p className="text-xs text-ink-500">
                    Módulo {moduleNumber}: {moduleName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={loading || !data}
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-xs"
                >
                  <Printer size={14} /> Imprimir Lista (PDF)
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-ink-400 hover:text-ink-700 hover:bg-lilac-100/50 rounded-xl transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 printable-area">
              
              {/* Header visible al imprimir */}
              <div className="hidden print:block mb-6 border-b border-ink-900 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold uppercase tracking-wide">FACOP - CLÍNICA & CAPACITACIÓN ODONTOLÓGICA</h1>
                    <h2 className="text-base font-semibold text-gray-800">LISTA DE ASISTENCIA Y REGISTRO DE PAGOS</h2>
                  </div>
                  <div className="text-right text-xs">
                    <p><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString("es-EC")}</p>
                    {data?.moduleDate && <p><strong>Fecha de Clase:</strong> {data.moduleDate}</p>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 text-xs gap-2 pt-2 border-t border-gray-200">
                  <p><strong>Curso:</strong> {data?.courseName}</p>
                  <p><strong>Módulo {moduleNumber}:</strong> {moduleName}</p>
                  <p>
                    <strong>Docente(s):</strong>{" "}
                    {data?.teachers?.length > 0 
                      ? data.teachers.map((t: any) => t.full_name).join(", ")
                      : "Sin asignar"}
                  </p>
                  <p><strong>Total Alumnos:</strong> {data?.students?.length || 0}</p>
                </div>
              </div>

              {loading ? (
                <div className="py-16 text-center text-ink-500 space-y-2">
                  <Loader2 size={24} className="animate-spin text-lilac-600 mx-auto" />
                  <p className="text-xs font-semibold">Cargando lista de alumnos del módulo...</p>
                </div>
              ) : errorMsg ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} /> {errorMsg}
                </div>
              ) : (
                <>
                  {/* Resumen de estados y filtro de búsqueda (No imprimibles) */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 no-print">
                    <div className="bg-lilac-50/50 border border-lilac-100 p-3 rounded-xl">
                      <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider block">Total Matriculados</span>
                      <span className="text-lg font-bold text-ink-950">{data?.students?.length || 0}</span>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Pagados / Facturados</span>
                      <span className="text-lg font-bold text-emerald-700">{paidCount}</span>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pendientes de Pago</span>
                      <span className="text-lg font-bold text-amber-700">{pendingCount}</span>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Becados / Gratis</span>
                      <span className="text-lg font-bold text-blue-700">{freeCount}</span>
                    </div>
                  </div>

                  {/* Búsqueda */}
                  <div className="relative no-print">
                    <Search size={14} className="absolute left-3.5 top-3 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Buscar alumno por nombre o documento..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input pl-9 text-xs"
                    />
                  </div>

                  {/* Tabla de Alumnos */}
                  <div className="border border-lilac-100 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-lilac-50/70 text-ink-800 font-bold uppercase tracking-wider border-b border-lilac-100">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Cédula / Pasaporte</th>
                          <th className="py-2.5 px-3">Nombre del Alumno</th>
                          <th className="py-2.5 px-3">Teléfono</th>
                          <th className="py-2.5 px-3">Estado de Pago</th>
                          <th className="py-2.5 px-3 text-center">Firma de Asistencia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-lilac-50">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-ink-400 italic">
                              No hay alumnos registrados en este módulo.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((st: any, idx: number) => (
                            <tr key={st.moduloInscripcionId} className="hover:bg-lilac-50/20 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-center text-ink-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-mono text-ink-800">{st.documentNumber}</td>
                              <td className="py-2.5 px-3 font-bold text-ink-950">{st.fullName}</td>
                              <td className="py-2.5 px-3 text-ink-600">{st.phone}</td>
                              
                              {/* Selector de Estado de Pago */}
                              <td className="py-2.5 px-3">
                                <div className="no-print">
                                  <select
                                    value={st.billingStatus}
                                    disabled={updatingId === st.moduloInscripcionId}
                                    onChange={(e) => handleStatusChange(st.moduloInscripcionId, e.target.value)}
                                    className={`text-xs font-bold py-1 px-2 rounded-lg border outline-none cursor-pointer transition ${
                                      st.billingStatus === "invoiced"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : st.billingStatus === "free"
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    <option value="pending">🔴 Pendiente</option>
                                    <option value="invoiced">🟢 Pagado / Facturado</option>
                                    <option value="free">🟡 Becado / Gratis</option>
                                  </select>
                                </div>
                                
                                {/* Estado visible solo en impresión */}
                                <div className="hidden print:block font-bold">
                                  {st.billingStatus === "invoiced" ? "PAGADO" : st.billingStatus === "free" ? "GRATIS" : "PENDIENTE"}
                                </div>
                              </td>

                              {/* Espacio para firma */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="w-36 h-7 border border-dashed border-gray-300 rounded mx-auto flex items-center justify-center text-[10px] text-gray-300">
                                  Firma
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pie de página de asistencia (Impresión) */}
                  <div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
                    <div className="grid grid-cols-2 gap-16 text-center text-xs">
                      <div>
                        <div className="border-b border-gray-400 w-48 mx-auto mb-1"></div>
                        <p className="font-bold">Firma del Profesor / Docente</p>
                        <p className="text-[10px] text-gray-500">Responsable de Asistencia</p>
                      </div>
                      <div>
                        <div className="border-b border-gray-400 w-48 mx-auto mb-1"></div>
                        <p className="font-bold">Firma Dirección Académica</p>
                        <p className="text-[10px] text-gray-500">FACOP Capacitación</p>
                      </div>
                    </div>
                  </div>

                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CSS para Impresión Limpia */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
