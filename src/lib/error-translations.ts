const AUTH_ERROR_MAP: Record<string, string> = {
  "invalid login credentials": "Correo o contraseña incorrectos.",
  "email not confirmed": "El correo electrónico no ha sido verificado.",
  "password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres.",
  "password should be at least 8 characters": "La contraseña debe tener al menos 8 caracteres.",
  "user already exists": "Ya existe un usuario con este correo electrónico.",
  "new password should be different from the old one": "La nueva contraseña debe ser diferente a la anterior.",
  "invalid password": "La contraseña ingresada no es válida.",
  "user not found": "Usuario no encontrado.",
  "too many requests": "Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.",
  "email rate limit exceeded": "Has superado el límite de envíos de correo de Supabase. Por favor espera 60 segundos antes de solicitar un nuevo enlace.",
  "rate limit exceeded": "Has superado el límite de solicitudes de Supabase. Por favor espera 60 segundos antes de intentar de nuevo.",
  "for security purposes, you can only request this once every": "Por seguridad, solo puedes solicitar la recuperación una vez cada 60 segundos."
};

export function translateAuthError(errorMsg: string | undefined | null): string {
  if (!errorMsg) return "Ha ocurrido un error inesperado.";
  const normalized = errorMsg.toLowerCase().trim();
  
  // Buscar coincidencia exacta
  if (AUTH_ERROR_MAP[normalized]) {
    return AUTH_ERROR_MAP[normalized];
  }

  // Buscar coincidencia parcial
  for (const [key, val] of Object.entries(AUTH_ERROR_MAP)) {
    if (normalized.includes(key)) {
      return val;
    }
  }

  return errorMsg;
}
