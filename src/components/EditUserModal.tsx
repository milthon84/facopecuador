"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Shield,
  ToggleLeft,
  KeyRound,
} from "lucide-react";
import { updateUserAction, resetUserPasswordAction } from "@/app/(admin)/erp/usuarios/actions";

interface Props {
  user: {
    id: string;
    email: string;
    full_name?: string | null;
    role?: string | null;
    is_active: boolean;
  };
  systemRoles: { name: string; label: string }[];
  isCurrentUser: boolean;
}

export default function EditUserModal({ user, systemRoles, isCurrentUser }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [role, setRole] = useState(user.role ?? "recepcionista");
  const [isActive, setIsActive] = useState(user.is_active);

  // Password reset states
  const [showReset, setShowReset] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetToast, setResetToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  function openModal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFullName(user.full_name ?? "");
    setRole(user.role ?? "recepcionista");
    setIsActive(user.is_active);
    setToast(null);
    setShowReset(false);
    setTempPassword("");
    setResetToast(null);
    setOpen(true);
  }

  async function handleResetPassword(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!tempPassword || tempPassword.length < 8) {
      setResetToast({ type: "error", msg: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    setResetLoading(true);
    setResetToast(null);

    try {
      await resetUserPasswordAction(user.id, tempPassword);
      setResetToast({ type: "success", msg: "Contraseña restablecida correctamente." });
      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setShowReset(false);
        setTempPassword("");
        setResetToast(null);
      }, 1500);
    } catch (err: any) {
      setResetToast({ type: "error", msg: err.message || "No se pudo restablecer." });
    } finally {
      setResetLoading(false);
    }
  }

  function closeModal(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (loading) return;
    setOpen(false);
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    setLoading(true);
    setToast(null);

    try {
      await updateUserAction({
        id: user.id,
        full_name: fullName,
        role: role,
        is_active: isActive,
      });

      setToast({ type: "success", msg: "Usuario actualizado correctamente." });
      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setToast(null);
      }, 1200);
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "No se pudo guardar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-lilac-200 bg-white text-lilac-700 hover:bg-lilac-50 hover:border-lilac-400 transition-all shadow-sm"
        title="Editar datos del usuario"
      >
        <Pencil size={12} />
        <span>Editar</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white border border-lilac-100 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-lilac-50">
              <div>
                <h2 className="text-base font-bold text-ink-900">Editar Usuario</h2>
                <p className="text-xs text-ink-500 mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={closeModal}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-ink-400 hover:bg-lilac-50 hover:text-ink-700 transition disabled:opacity-40"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5 space-y-4">
              {/* Nombre completo */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User size={12} className="text-lilac-500" />
                    Nombre completo
                  </span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  placeholder="Ej. María González"
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Shield size={12} className="text-lilac-500" />
                    Rol del sistema
                  </span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading || isCurrentUser}
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60 bg-white"
                >
                  {systemRoles.map((r) => (
                    <option key={r.name} value={r.name}>{r.label}</option>
                  ))}
                </select>
                {isCurrentUser && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Para evitar perder el acceso, no puedes cambiar tu propio rol.
                  </p>
                )}
              </div>

              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <ToggleLeft size={12} className="text-lilac-500" />
                    Estado de la cuenta
                  </span>
                </label>
                <select
                  value={String(isActive)}
                  onChange={(e) => setIsActive(e.target.value === "true")}
                  disabled={loading || isCurrentUser}
                  className="w-full px-3.5 py-2.5 text-sm border border-lilac-200 rounded-xl outline-none focus:ring-2 focus:ring-lilac-300 focus:border-lilac-400 transition disabled:bg-ink-50 disabled:opacity-60 bg-white"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
                {isCurrentUser && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Para evitar bloquearte, no puedes desactivar tu propio usuario.
                  </p>
                )}
              </div>

              {/* Sección de Restablecimiento de Contraseña */}
              <div className="pt-4 border-t border-lilac-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(!showReset);
                    setTempPassword("");
                    setResetToast(null);
                  }}
                  className="text-xs font-semibold text-lilac-600 hover:text-lilac-700 transition flex items-center gap-1.5"
                >
                  <KeyRound size={12} />
                  {showReset ? "Ocultar opciones de contraseña" : "Restablecer contraseña..."}
                </button>

                {showReset && (
                  <div className="mt-3 bg-lilac-50/50 border border-lilac-100 rounded-xl p-3.5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-xs font-semibold text-ink-700 mb-1.5">
                        Contraseña temporal nueva
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tempPassword}
                          onChange={(e) => setTempPassword(e.target.value)}
                          disabled={resetLoading}
                          placeholder="Mínimo 8 caracteres"
                          className="flex-1 px-3 py-2 text-xs border border-lilac-200 rounded-lg outline-none focus:ring-1 focus:ring-lilac-300 focus:border-lilac-400 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
                            let pass = "";
                            for (let i = 0; i < 10; i++) {
                              pass += chars.charAt(Math.floor(Math.random() * chars.length));
                            }
                            setTempPassword(pass);
                          }}
                          disabled={resetLoading}
                          className="px-3 py-1 text-[11px] font-semibold text-ink-700 bg-white border border-lilac-200 hover:bg-lilac-50 rounded-lg transition shrink-0"
                        >
                          Generar
                        </button>
                      </div>
                      <p className="text-[10px] text-ink-500 mt-1">
                        Se le obligará a cambiar esta clave en su próximo acceso.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={resetLoading || tempPassword.length < 8}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition disabled:opacity-50"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 size={12} className="animate-spin" /> Guardando...
                        </>
                      ) : (
                        "Establecer y forzar cambio"
                      )}
                    </button>

                    {resetToast && (
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold border ${
                          resetToast.type === "success"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-red-50 border-red-200 text-red-700"
                        }`}
                      >
                        {resetToast.type === "success" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <AlertCircle size={12} />
                        )}
                        {resetToast.msg}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toast feedback */}
              {toast && (
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border animate-in fade-in duration-200 ${
                    toast.type === "success"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {toast.type === "success" ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  {toast.msg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-2">
              <button
                onClick={closeModal}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-700 bg-ink-100 hover:bg-ink-200 transition disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-lilac-600 hover:bg-lilac-700 transition shadow-sm shadow-lilac-200 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save size={13} /> Guardar cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
