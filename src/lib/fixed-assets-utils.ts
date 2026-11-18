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
 * Tabla oficial de tipos de activos y depreciación SRI (Ecuador)
 */
export const ASSET_TYPES: Record<string, AssetTypeDefinition> = {
  equipos_medicos: {
    id: "equipos_medicos",
    label: "Equipos Médicos y Odontológicos (Maquinaria y Equipo)",
    category: "Instalaciones, maquinarias, equipos y muebles",
    prefix: "EQM",
    years: 10,
    percentage: 10,
    accountCode: "1.2.01.01",
    accountName: "Equipos Médicos y Odontológicos",
    depExpCode: "5.2.08",
    depExpName: "Depreciaciones",
  },
  mobiliario: {
    id: "mobiliario",
    label: "Mobiliario y Enseres (Instalaciones y Muebles)",
    category: "Instalaciones, maquinarias, equipos y muebles",
    prefix: "MUE",
    years: 10,
    percentage: 10,
    accountCode: "1.2.01.02",
    accountName: "Mobiliario y Enseres",
    depExpCode: "5.2.08",
    depExpName: "Depreciaciones",
  },
  computacion: {
    id: "computacion",
    label: "Equipos de Cómputo y Software",
    category: "Equipos de cómputo y software",
    prefix: "COM",
    years: 3,
    percentage: 33.33,
    accountCode: "1.2.01.03",
    accountName: "Equipos de Computación y Software",
    depExpCode: "5.2.08",
    depExpName: "Depreciaciones",
  },
  inmuebles: {
    id: "inmuebles",
    label: "Inmuebles (Edificios, naves, excepto terrenos)",
    category: "Inmuebles",
    prefix: "INM",
    years: 20,
    percentage: 5,
    accountCode: "1.2.01.04",
    accountName: "Inmuebles e Instalaciones",
    depExpCode: "5.2.08",
    depExpName: "Depreciaciones",
  },
  vehiculos: {
    id: "vehiculos",
    label: "Vehículos, Equipos de Transporte",
    category: "Vehículos, equipos de transporte y equipo caminero móvil",
    prefix: "VEH",
    years: 5,
    percentage: 20,
    accountCode: "1.2.01.05",
    accountName: "Vehículos y Transporte",
    depExpCode: "5.2.08",
    depExpName: "Depreciaciones",
  },
};

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
