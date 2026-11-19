export interface AssetTypeDefinition {
  id: string;
  label: string;
  category: string;
  prefix: string;
  years: number;
  percentage: number;
  accountCode: string;
  accountName: string;
  depExpCode: string;
  depExpName: string;
}

/**
 * Tabla oficial de cuentas de activos fijos del Plan de Cuentas y depreciación SRI (Ecuador)
 */
export const ASSET_TYPES: Record<string, AssetTypeDefinition> = {
  equipos_medicos: {
    id: "equipos_medicos",
    label: "1.2.01.01 — Equipos Médicos y Odontológicos",
    category: "Equipos Médicos y Odontológicos",
    prefix: "EQM",
    years: 10,
    percentage: 10,
    accountCode: "1.2.01.01",
    accountName: "Equipos Médicos y Odontológicos",
    depExpCode: "5.2.08.01",
    depExpName: "Depreciación Equipos Médicos y Odontológicos",
  },
  mobiliario: {
    id: "mobiliario",
    label: "1.2.01.02 — Mobiliario y Enseres",
    category: "Mobiliario y Enseres",
    prefix: "MUE",
    years: 10,
    percentage: 10,
    accountCode: "1.2.01.02",
    accountName: "Mobiliario y Enseres",
    depExpCode: "5.2.08.02",
    depExpName: "Depreciación Mobiliario y Enseres",
  },
  computacion: {
    id: "computacion",
    label: "1.2.01.03 — Equipos de Computación y Software",
    category: "Equipos de Computación y Software",
    prefix: "COM",
    years: 3,
    percentage: 33.33,
    accountCode: "1.2.01.03",
    accountName: "Equipos de Computación y Software",
    depExpCode: "5.2.08.03",
    depExpName: "Depreciación Equipos de Computación y Software",
  },
  inmuebles: {
    id: "inmuebles",
    label: "1.2.01.04 — Inmuebles e Instalaciones",
    category: "Inmuebles e Instalaciones",
    prefix: "INM",
    years: 20,
    percentage: 5,
    accountCode: "1.2.01.04",
    accountName: "Inmuebles e Instalaciones",
    depExpCode: "5.2.08.04",
    depExpName: "Depreciación Inmuebles e Instalaciones",
  },
  vehiculos: {
    id: "vehiculos",
    label: "1.2.01.05 — Vehículos y Transporte",
    category: "Vehículos y Transporte",
    prefix: "VEH",
    years: 5,
    percentage: 20,
    accountCode: "1.2.01.05",
    accountName: "Vehículos y Transporte",
    depExpCode: "5.2.08.05",
    depExpName: "Depreciación Vehículos y Equipos de Transporte",
  },
};

/**
 * Obtiene la cuenta contable y descripción formateada para visualización de un activo
 */
export function getAssetAccountInfo(asset: {
  account_code?: string | null;
  category?: string | null;
  description?: string | null;
}): { code: string; name: string; full: string } {
  const code = (asset.account_code || "").trim();
  if (code) {
    const match = Object.values(ASSET_TYPES).find((t) => t.accountCode === code);
    if (match) {
      return {
        code: match.accountCode,
        name: match.accountName,
        full: `${match.accountCode} · ${match.accountName}`,
      };
    }
  }

  // Deducir por categoría o descripción histórica
  const cat = `${asset.category || ""} ${asset.description || ""}`.toLowerCase();
  if (cat.includes("médic") || cat.includes("odont") || cat.includes("maquinaria") || cat.includes("sillon")) {
    return {
      code: "1.2.01.01",
      name: "Equipos Médicos y Odontológicos",
      full: "1.2.01.01 · Equipos Médicos y Odontológicos",
    };
  }
  if (cat.includes("mobil") || cat.includes("mueble") || cat.includes("enser") || cat.includes("oficina")) {
    return {
      code: "1.2.01.02",
      name: "Mobiliario y Enseres",
      full: "1.2.01.02 · Mobiliario y Enseres",
    };
  }
  if (cat.includes("comput") || cat.includes("softw") || cat.includes("cómputo") || cat.includes("laptop")) {
    return {
      code: "1.2.01.03",
      name: "Equipos de Computación y Software",
      full: "1.2.01.03 · Equipos de Computación y Software",
    };
  }
  if (cat.includes("inmuebl") || cat.includes("edific")) {
    return {
      code: "1.2.01.04",
      name: "Inmuebles e Instalaciones",
      full: "1.2.01.04 · Inmuebles e Instalaciones",
    };
  }
  if (cat.includes("vehíc") || cat.includes("transp") || cat.includes("camion") || cat.includes("auto")) {
    return {
      code: "1.2.01.05",
      name: "Vehículos y Transporte",
      full: "1.2.01.05 · Vehículos y Transporte",
    };
  }

  return {
    code: code || "1.2.01",
    name: asset.category || "Propiedad, Planta y Equipo",
    full: `${code || "1.2.01"} · ${asset.category || "Propiedad, Planta y Equipo"}`,
  };
}

/**
 * Resuelve el tipo de activo según el código de cuenta o descripción del gasto
 */
export function resolveAssetTypeFromExpenseItem(
  accountCode?: string | null,
  description?: string | null
): AssetTypeDefinition {
  const code = (accountCode || "").trim();
  const desc = (description || "").toLowerCase();

  if (code === "1.2.01.03" || desc.includes("comput") || desc.includes("laptop") || desc.includes("software") || desc.includes("impresora")) {
    return ASSET_TYPES.computacion;
  }

  if (code === "1.2.01.02" || desc.includes("mueble") || desc.includes("ensere") || desc.includes("silla") || desc.includes("escritorio")) {
    return ASSET_TYPES.mobiliario;
  }

  if (code === "1.2.01.04" || desc.includes("edificio") || desc.includes("inmueble") || desc.includes("local")) {
    return ASSET_TYPES.inmuebles;
  }

  if (code === "1.2.01.05" || desc.includes("vehiculo") || desc.includes("vehículo") || desc.includes("auto") || desc.includes("camioneta")) {
    return ASSET_TYPES.vehiculos;
  }

  // Por defecto clínica / odontológico (Maquinaria y Equipo)
  return ASSET_TYPES.equipos_medicos;
}

/**
 * Extrae el código secuencial de un activo fijo si está guardado en columna o en descripción
 */
export function extractAssetCode(asset: {
  code?: string | null;
  description?: string | null;
  name?: string | null;
  id?: string;
}): string {
  if (asset.code && asset.code.trim()) {
    return asset.code.trim();
  }

  const desc = asset.description || "";
  const match = desc.match(/\[CODIGO:\s*([A-Z]{3,4}-\d{4})\]/i);
  if (match) {
    return match[1].toUpperCase();
  }

  const nameMatch = (asset.name || "").match(/\b([A-Z]{3,4}-\d{4})\b/);
  if (nameMatch) {
    return nameMatch[1].toUpperCase();
  }

  return "";
}
