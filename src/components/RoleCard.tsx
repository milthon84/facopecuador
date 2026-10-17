"use client";

import { useState } from "react";
import { 
  Shield, 
  Lock, 
  Trash2, 
  Save, 
  ShieldCheck, 
  Pencil, 
  ChevronDown, 
  Check, 
  Loader2, 
  Sparkles,
  Layers,
  AlertCircle
} from "lucide-react";
import StandardModal from "@/components/StandardModal";
import { updateRoleInfoAction, savePermissionsAction, deleteRoleAction } from "@/app/(admin)/erp/roles/actions";
import { ALL_RESOURCES, RESOURCE_SECTIONS, getWritePathForResource } from "@/lib/roles";

const COLOR_OPTIONS = [
  { value: "bg-lilac-100 text-lilac-800 border-lilac-300", label: "Morado", dot: "bg-purple-500" },
  { value: "bg-blue-50 text-blue-800 border-blue-200",       label: "Azul",   dot: "bg-blue-500" },
  { value: "bg-green-50 text-green-800 border-green-300",    label: "Verde",  dot: "bg-emerald-500" },
  { value: "bg-amber-50 text-amber-800 border-amber-200",    label: "Ámbar",  dot: "bg-amber-500" },
  { value: "bg-rose-50 text-rose-800 border-rose-200",       label: "Rosa",   dot: "bg-rose-500" },
  { value: "bg-orange-50 text-orange-800 border-orange-200", label: "Naranja",dot: "bg-orange-500" },
  { value: "bg-teal-50 text-teal-800 border-teal-200",       label: "Teal",   dot: "bg-teal-500" },
  { value: "bg-gray-100 text-gray-800 border-gray-200",      label: "Gris",   dot: "bg-slate-500" },
];

export interface SystemRoleData {
  name: string;
  label: string;
  color: string;
  description: string | null;
  is_system: boolean;
}

interface Props {
  role: SystemRoleData;
  initialPerms: string[];
}

export default function RoleCard({ role, initialPerms }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState<Set<string>>(new Set(initialPerms));

  // Estados de modales
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Estados de formularios
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estado del formulario de edición de info
  const [editLabel, setEditLabel] = useState(role.label);
  const [editColor, setEditColor] = useState(role.color);
  const [editDescription, setEditDescription] = useState(role.description || "");

  const isAdmin = role.name === "admin";

  // Conteo de permisos activos para el badge ejecutivo
  const activePermsCount = ALL_RESOURCES.filter(r => {
    const writePath = getWritePathForResource(r.path);
    return perms.has(writePath) || perms.has(r.path);
  }).length;

  // Manejar actualización de permisos
  async function handleSavePermissions(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPerms(true);
    setSavedSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("roleName", role.name);
      await savePermissionsAction(formData);

      // Actualizar estado local
      const newPerms = new Set<string>();
      ALL_RESOURCES.forEach(r => {
        const val = formData.get(`perm_${r.path}`) as string;
        if (val === "ver" || val === "editar") {
          newPerms.add(r.path);
        }
        if (val === "editar" && r.hasEdit) {
          newPerms.add(getWritePathForResource(r.path));
        }
      });
      setPerms(newPerms);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert("Error al guardar permisos: " + err.message);
    } finally {
      setSavingPerms(false);
    }
  }

  // Manejar actualización de información del rol
  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!editLabel.trim()) {
      setFormError("El nombre visible del rol es requerido.");
      return;
    }

    setSavingInfo(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("roleName", role.name);
      formData.append("label", editLabel.trim());
      formData.append("color", editColor);
      formData.append("description", editDescription.trim());

      await updateRoleInfoAction(formData);
      setIsEditOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Error al actualizar la información.");
    } finally {
      setSavingInfo(false);
    }
  }

  // Manejar eliminación del rol
  async function handleDeleteRole() {
    setDeleting(true);
    try {
      const formData = new FormData();
      formData.append("roleName", role.name);
      await deleteRoleAction(formData);
      setIsDeleteOpen(false);
    } catch (err: any) {
      alert("Error al eliminar el rol: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div 
        className={`bg-white border rounded-2xl shadow-xs transition-all duration-200 overflow-hidden ${
          expanded 
            ? "border-lilac-300 ring-2 ring-lilac-50/60 shadow-md" 
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
        }`}
      >
        {/* Cabecera del Rol (Toda el área es clickeable para abrir/cerrar permisos) */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="px-5 py-4 cursor-pointer select-none transition-colors hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
        >
          {/* Izquierda: Badge de Rol + Datos + Descripción */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${role.color}`}>
                {role.label}
              </span>

              {role.is_system && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                  <Lock size={10} className="text-slate-400" />
                  <span>Sistema</span>
                </span>
              )}

              <code className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/40">
                {role.name}
              </code>

              {!isAdmin && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200/60">
                  <Layers size={11} className="text-lilac-500" />
                  <span>{activePermsCount} de {ALL_RESOURCES.length} accesos</span>
                </span>
              )}
            </div>

            {/* Descripción ejecutiva debajo del rol */}
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-1 font-normal">
              {role.description || "Sin descripción asignada para este perfil."}
            </p>
          </div>

          {/* Derecha: Botón Editar Info + Eliminar + Flecha de Expansión */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {!isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditLabel(role.label);
                  setEditColor(role.color);
                  setEditDescription(role.description || "");
                  setFormError(null);
                  setIsEditOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl transition shadow-2xs active:scale-95"
                title="Editar nombre, color y descripción"
              >
                <Pencil size={12} className="text-slate-500" />
                <span>Editar info</span>
              </button>
            )}

            {!role.is_system && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-xl transition shadow-2xs active:scale-95"
                title="Eliminar este rol personalizado"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}

            {/* Indicador animado de despliegue */}
            <div className={`p-1.5 rounded-xl transition-transform duration-200 ${expanded ? "rotate-180 bg-lilac-50 text-lilac-700" : "text-slate-400 hover:bg-slate-100"}`}>
              <ChevronDown size={18} />
            </div>
          </div>
        </div>

        {/* Panel Desplegable de Permisos (se abre al dar clic en la tarjeta) */}
        {expanded && (
          <div className="border-t border-slate-100 bg-slate-50/30 animate-fade-in">
            {isAdmin ? (
              <div className="p-6 flex items-center gap-3 text-slate-700 bg-lilac-50/30">
                <div className="w-10 h-10 rounded-xl bg-lilac-100 text-lilac-700 flex items-center justify-center shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Acceso Total Administrativo
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    El rol Administrador tiene privilegios absolutos sobre todos los módulos, ajustes y funciones del sistema sin restricciones.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSavePermissions} className="p-5 sm:p-6 bg-white">
                <input type="hidden" name="roleName" value={role.name} />

                {/* Grid minimalista de módulos y permisos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                  {RESOURCE_SECTIONS.map((section) => {
                    const sectionResources = ALL_RESOURCES.filter(r => r.section === section);
                    return (
                      <div 
                        key={section} 
                        className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-lilac-600" />
                            {section}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {sectionResources.length} {sectionResources.length === 1 ? "recurso" : "recursos"}
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {sectionResources.map((r) => {
                            const writePath = getWritePathForResource(r.path);
                            const currentVal = perms.has(writePath) ? "editar" : perms.has(r.path) ? "ver" : "ninguno";

                            return (
                              <div key={r.path} className="flex items-center justify-between py-2.5 first:pt-1 last:pb-1 gap-3">
                                <div className="min-w-0 pr-2">
                                  <p className="text-xs font-medium text-slate-800 leading-tight">
                                    {r.label}
                                  </p>
                                  <code className="text-[10px] text-slate-400 font-mono truncate block mt-0.5">
                                    {r.path}
                                  </code>
                                </div>

                                {/* Control segmentado minimalista tipo iOS/macOS */}
                                <div className="flex bg-slate-100/90 border border-slate-200/70 rounded-xl p-0.5 shrink-0 select-none shadow-2xs">
                                  {/* Ninguno */}
                                  <label className="cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`perm_${r.path}`}
                                      value="ninguno"
                                      defaultChecked={currentVal === "ninguno"}
                                      className="sr-only peer"
                                    />
                                    <div className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-500 peer-checked:bg-white peer-checked:text-slate-800 peer-checked:shadow-xs transition-all hover:text-slate-800">
                                      Ninguno
                                    </div>
                                  </label>

                                  {/* Ver / Permitir */}
                                  <label className="cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`perm_${r.path}`}
                                      value="ver"
                                      defaultChecked={currentVal === "ver"}
                                      className="sr-only peer"
                                    />
                                    <div className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-500 peer-checked:bg-lilac-600 peer-checked:text-white peer-checked:shadow-xs transition-all hover:text-slate-800">
                                      {r.path === "/erp/asistencia/timbrar" || r.path === "/erp/puerta" ? "Permitir" : "Ver"}
                                    </div>
                                  </label>

                                  {/* Editar / Modificar */}
                                  {r.hasEdit && (
                                    <label className="cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`perm_${r.path}`}
                                        value="editar"
                                        defaultChecked={currentVal === "editar"}
                                        className="sr-only peer"
                                      />
                                      <div className="px-2.5 py-1 text-[11px] font-semibold rounded-lg text-slate-500 peer-checked:bg-amber-600 peer-checked:text-white peer-checked:shadow-xs transition-all hover:text-slate-800">
                                        {r.path === "/erp/puerta" ? "Configurar" : "Editar"}
                                      </div>
                                    </label>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Barra de acción inferior */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    {savedSuccess ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Check size={14} /> ¡Permisos guardados y sincronizados correctamente!
                      </span>
                    ) : (
                      <span>Los permisos se aplicarán al instante para los usuarios con este rol.</span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingPerms}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {savingPerms ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-white/70" />
                        <span>Guardando cambios...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Guardar Permisos</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Modal para Editar Información del Rol (Arriba a la derecha) */}
      <StandardModal
        isOpen={isEditOpen}
        onClose={() => !savingInfo && setIsEditOpen(false)}
        title="Editar Rol"
        subtitle={`Modifica la etiqueta visual, color o descripción de ${role.name}`}
        icon={<Pencil size={18} />}
        loading={savingInfo}
        loadingText="Guardando cambios del rol..."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              disabled={savingInfo}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveInfo}
              disabled={savingInfo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Save size={13} />
              <span>Guardar Cambios</span>
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveInfo} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre Visible
            </label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
              placeholder="Ej. Asistente Administrativo"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Color de Etiqueta
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditColor(c.value)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition text-left ${
                    editColor === c.value
                      ? "ring-2 ring-purple-600 border-purple-500 shadow-2xs font-bold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${c.dot} shrink-0`} />
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Descripción Ejecutiva
            </label>
            <textarea
              rows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition"
              placeholder="Describe brevemente las responsabilidades o alcance de este rol..."
            />
          </div>
        </form>
      </StandardModal>

      {/* Modal de Confirmación para Eliminar Rol */}
      <StandardModal
        isOpen={isDeleteOpen}
        onClose={() => !deleting && setIsDeleteOpen(false)}
        title="Eliminar Rol"
        subtitle={`¿Estás seguro de que deseas eliminar permanentemente el rol ${role.label}?`}
        icon={<Trash2 size={18} className="text-rose-600" />}
        loading={deleting}
        loadingText="Eliminando rol..."
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteRole}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Trash2 size={13} />
              <span>Eliminar Rol</span>
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          Esta acción removerá el rol <strong>{role.label}</strong> ({role.name}) y todos sus permisos configurados. Los usuarios asignados a este rol deberán ser reasignados a otro rol. Esta acción no se puede deshacer.
        </p>
      </StandardModal>
    </>
  );
}
