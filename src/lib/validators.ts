// =====================================================
// VALIDADORES PARA ECUADOR
// =====================================================

// ── Cédula ecuatoriana ────────────────────────────────────────────────────
export function validateCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const province = parseInt(cedula.substring(0, 2));
  if (province < 1 || province > 24) return false;
  if (parseInt(cedula[2]) >= 6) return false;

  const coefs = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = parseInt(cedula[i]) * coefs[i];
    if (v >= 10) v -= 9;
    sum += v;
  }
  const check = sum % 10 === 0 ? 0 : 10 - (sum % 10);
  return check === parseInt(cedula[9]);
}

// ── RUC persona natural (cédula + 001) ───────────────────────────────────
function validateRUCNatural(ruc: string): boolean {
  return validateCedula(ruc.substring(0, 10)) && ruc.substring(10) === "001";
}

// ── RUC entidad pública (3er dígito = 6) ─────────────────────────────────
function validateRUCPublico(ruc: string): boolean {
  const d = ruc.split("").map(Number);
  const coefs = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += d[i] * coefs[i];
  const rem = sum % 11;
  const check = rem === 0 ? 0 : 11 - rem;
  return check === d[8] && ruc.substring(9, 12) === "001";
}

// ── RUC sociedad privada (3er dígito = 9) ────────────────────────────────
function validateRUCPrivado(ruc: string): boolean {
  const d = ruc.split("").map(Number);
  const coefs = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i] * coefs[i];
  const rem = sum % 11;
  const check = rem === 0 ? 0 : 11 - rem;
  return check === d[9] && ruc.substring(10, 13) === "001";
}

// ── RUC ecuatoriano (13 dígitos) ─────────────────────────────────────────
export function validateRUC(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const province = parseInt(ruc.substring(0, 2));
  if (province < 1 || province > 24) return false;
  const type = parseInt(ruc[2]);
  if (type < 6) return validateRUCNatural(ruc);
  if (type === 6) return validateRUCPublico(ruc);
  if (type === 9) return validateRUCPrivado(ruc);
  return false;
}

export function isPassportDocument(doc: string): boolean {
  const clean = doc.trim();
  if (!clean) return false;
  // Si contiene letras es pasaporte/documento extranjero
  if (/[a-zA-Z]/.test(clean)) return true;
  // Si no tiene 10 ni 13 dígitos
  if (clean.length !== 10 && clean.length !== 13) return true;
  return false;
}

export function validateDocumento(doc: string, isPassport?: boolean): string | null {
  const clean = doc.trim();
  if (!clean) return "Campo requerido";

  if (isPassport) {
    if (clean.length < 3 || clean.length > 20) {
      return "El pasaporte debe tener entre 3 y 20 caracteres";
    }
    if (!/^[A-Za-z0-9\-]+$/.test(clean)) {
      return "El pasaporte solo puede contener letras, números y guiones";
    }
    return null;
  }

  const cleanDoc = clean.replace(/[\s\-]/g, "");
  if (cleanDoc.length === 10) {
    if (!/^\d{10}$/.test(cleanDoc)) return "La cédula debe tener 10 dígitos numéricos";
    if (!validateCedula(cleanDoc)) return "Cédula inválida — verifica el número";
    return null;
  }
  if (cleanDoc.length === 13) {
    if (!/^\d{13}$/.test(cleanDoc)) return "El RUC debe tener 13 dígitos numéricos";
    if (!validateRUC(cleanDoc)) return "RUC inválido — verifica el número";
    return null;
  }
  return "Debe ser cédula (10 dígitos) o RUC (13 dígitos)";
}

// ── Email ─────────────────────────────────────────────────────────────────
export function validateEmail(email: string): string | null {
  if (!email.trim()) return "El email es requerido";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Email inválido";
  return null;
}

// ── Teléfono Ecuador ──────────────────────────────────────────────────────
// Celular: 09XXXXXXXX (10 dígitos), Convencional: 0X-XXXXXXX (9 dígitos)
export function validateTelefono(phone: string, optional = false): string | null {
  if (!phone.trim()) return optional ? null : "El teléfono es requerido";
  const clean = phone.replace(/[\s\-\(\)\+]/g, "");
  const isCelular     = /^09\d{8}$/.test(clean);      // 10 dígitos, empieza en 09
  const isConvencional = /^0[2-7]\d{7}$/.test(clean); // 9 dígitos, empieza en 02-07
  if (!isCelular && !isConvencional) {
    return "Teléfono inválido (ej: 0999999999 o 022123456)";
  }
  return null;
}
