"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Shield,
  ToggleLeft,
  KeyRound,
} from "lucide-react";
import StandardModal from "@/components/StandardModal";
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

  function closeModal() {
    if (loading || resetLoading) return;
    setOpen(false);
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
      }, 1200);
    } catch (err: any) {
      setResetToast({ type: "error", msg: err.message || "No se pudo restablecer." });
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!fullName.trim()) {
      setToast({ type: "error", msg: "El nombre completo no puede estar vacío." });
      return;
    }

    setLoading(true);
    setToast(null);

    try {
      await updateUserAction({
        id: user.id,
        full_name: fullName.trim(),
        role,
        is_active: isActive,
      });
      setToast({ type: "success", msg: "Usuario actualizado correctamente." });
      router.refresh();
      setTimeout(() => {
        setOpen(false);
      }, 600);
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "Error al actualizar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-lilac-200 bg-white text-lilac-700 hover:bg-lilac-50 hover:border-lilac-400 transition-all shadow-sm cursor-pointer"
        title="Editar datos del usuario"
      >
        <Pencil size={12} />
        <span>Editar</span>
      </button>

      <StandardModal
        isOpen={open}
        onClose={closeModal}
        title="Editar Usuario"
        subtitle={user.email}
        icon={<User size={18} />}
        loading={loading || resetLoading}
        loadingText={resetLoading ? "Restableciendo clave..." : "Guardando cambios del usuario..."}
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={loading || resetLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-ink-600 hover:bg-lilac-100 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || resetLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              <Save size={14} /> Guardar Cambios
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <User size={13} className="text-lilac-600" />
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

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Shield size={13} className="text-lilac-600" />
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
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                Para evitar perder el acceso, no puedes cambiar tu propio rol.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <ToggleLeft size={13} className="text-lilac-600" />
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
              <p className="text-[10px] text-amber-600 mt-1 font-medium">
                Para evitar bloquearte, no puedes desactivar tu propio usuario.
              </p>
            )}
          </div>

          {/* Sección de Restablecimiento de Contraseña */}
          <div className="pt-3 border-t border-lilac-100">
            <button
              type="button"
              onClick={() => {
                setShowReset(!showReset);
                setTempPassword("");
                setResetToast(null);
              }}
              className="text-xs font-bold text-lilac-700 hover:text-lilac-900 transition flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound size={13} />
              {showReset ? "Ocultar opciones de contraseña" : "Restablecer contraseña..."}
            </button>

            {showReset && (
              <div className="mt-3 bg-lilac-50/50 border border-lilac-100 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
                <div>
                  <label className="block text-xs font-bold text-ink-800 mb-1.5">
                    Contraseña temporal nueva
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      disabled={resetLoading}
                      placeholder="Mínimo 8 caracteres"
                      className="flex-1 px-3 py-2 text-xs border border-lilac-200 rounded-xl outline-none focus:ring-1 focus:ring-lilac-300 focus:border-lilac-400 bg-white"
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
                      className="px-3 py-1.5 text-xs font-bold text-ink-700 bg-white border border-lilac-200 hover:bg-lilac-50 rounded-xl transition shrink-0 cursor-pointer"
                    >
                      Generar
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-400 mt-1">
                    Se solicitará cambio de clave al próximo acceso.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading || tempPassword.length < 8}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-lilac-600 hover:bg-lilac-700 transition disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Guardando clave...
                    </>
                  ) : (
                    "Establecer y forzar cambio"
                  )}
                </button>

                {resetToast && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${
                      resetToast.type === "success"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {resetToast.type === "success" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <AlertCircle size={13} />
                    )}
                    <span>{resetToast.msg}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {toast && (
            <div
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border animate-in fade-in duration-150 ${
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
              <span>{toast.msg}</span>
            </div>
          )}
        </div>
      </StandardModal>
    </>
  );
}
