export interface ExpenseGroup {
  code: string;
  name: string;
  type: string;
}

export interface ExpenseMovementAccount {
  code: string;
  name: string;
  group_code: string;
  type: string;
}

export interface ExpenseAccountsCatalog {
  groups: ExpenseGroup[];
  accountsByGroup: Record<string, ExpenseMovementAccount[]>;
  allMovements: ExpenseMovementAccount[];
}

/**
 * Catálogo base fallback garantizado (en caso de consulta en frío)
 */
export const FALLBACK_EXPENSE_GROUPS: ExpenseGroup[] = [
  { code: "5.1.01", name: "Insumos y Materiales Clínicos", type: "GASTO" },
  { code: "5.1.02", name: "Honorarios Profesionales", type: "GASTO" },
  { code: "5.2.01", name: "Sueldos, Salarios y Beneficios", type: "GASTO" },
  { code: "5.2.02", name: "Arriendo del Local / Consultorio", type: "GASTO" },
  { code: "5.2.03", name: "Agua, Energía, Luz y Comunicaciones", type: "GASTO" },
  { code: "5.2.04", name: "Mantenimiento Equipos e Instalaciones", type: "GASTO" },
  { code: "5.2.05", name: "Suministros Oficina y Aseo", type: "GASTO" },
  { code: "5.2.06", name: "Publicidad, Marketing y Comisiones", type: "GASTO" },
  { code: "5.2.07", name: "Honorarios Externos", type: "GASTO" },
  { code: "5.2.09", name: "Impuestos, Tasas, Contribuciones", type: "GASTO" },
  { code: "5.2.10", name: "Seguros", type: "GASTO" },
  { code: "5.2.11", name: "Gastos de Viaje", type: "GASTO" },
  { code: "5.2.19", name: "Otros Gastos", type: "GASTO" },
  { code: "5.4.01", name: "Gastos Bancarios", type: "GASTO" },
  { code: "1.2.01", name: "Propiedad, Planta y Equipo (Activo Fijo)", type: "ACTIVO" },
];

export const FALLBACK_EXPENSE_MOVEMENTS: ExpenseMovementAccount[] = [
  // 5.1.01 Insumos y Materiales Clínicos
  { code: "5.1.01.01", name: "Insumos Dentales Utilizados", group_code: "5.1.01", type: "GASTO" },
  { code: "5.1.01.02", name: "Mantenimiento de Equipos", group_code: "5.1.01", type: "GASTO" },

  // 5.1.02 Honorarios Profesionales
  { code: "5.1.02.01", name: "Honorarios Laboratorios Dentales", group_code: "5.1.02", type: "GASTO" },
  { code: "5.1.02.02", name: "Honorarios Odontólogos Asociados", group_code: "5.1.02", type: "GASTO" },
  { code: "5.1.02.03", name: "Honorarios Profesores y Expositores", group_code: "5.1.02", type: "GASTO" },
  { code: "5.1.02.04", name: "Honorarios Otros Profesionales", group_code: "5.1.02", type: "GASTO" },

  // 5.2.01 Sueldos, Salarios y Beneficios
  { code: "5.2.01.01", name: "Sueldos y Salarios", group_code: "5.2.01", type: "GASTO" },
  { code: "5.2.01.02", name: "Aporte Patronal IESS", group_code: "5.2.01", type: "GASTO" },

  // 5.2.02 Arriendo del Local / Consultorio
  { code: "5.2.02.01", name: "Arriendo de Local", group_code: "5.2.02", type: "GASTO" },
  { code: "5.2.02.02", name: "Arriendo para Eventos", group_code: "5.2.02", type: "GASTO" },

  // 5.2.03 Agua, Energía, Luz y Comunicaciones
  { code: "5.2.03.01", name: "Energía Eléctrica", group_code: "5.2.03", type: "GASTO" },
  { code: "5.2.03.02", name: "Agua Potable", group_code: "5.2.03", type: "GASTO" },
  { code: "5.2.03.03", name: "Internet", group_code: "5.2.03", type: "GASTO" },
  { code: "5.2.03.04", name: "Datafast", group_code: "5.2.03", type: "GASTO" },

  // 5.2.04 Mantenimiento Equipos e Instalaciones
  { code: "5.2.04.01", name: "Mantenimiento Instalaciones/Adecuaciones", group_code: "5.2.04", type: "GASTO" },

  // 5.2.05 Suministros Oficina y Aseo
  { code: "5.2.05.01", name: "Útiles de Oficina", group_code: "5.2.05", type: "GASTO" },
  { code: "5.2.05.02", name: "Útiles de Aseo", group_code: "5.2.05", type: "GASTO" },
  { code: "5.2.05.03", name: "Suministros de Oficina", group_code: "5.2.05", type: "GASTO" },

  // 5.2.06 Publicidad, Marketing y Comisiones
  { code: "5.2.06.01", name: "Publicidad y Marketing", group_code: "5.2.06", type: "GASTO" },

  // 5.2.07 Honorarios Externos
  { code: "5.2.07.01", name: "Honorarios Externos (Contabilidad)", group_code: "5.2.07", type: "GASTO" },

  // 5.2.09 Impuestos, Tasas, Contribuciones
  { code: "5.2.09.01", name: "Patente", group_code: "5.2.09", type: "GASTO" },
  { code: "5.2.09.02", name: "1.5 por Mil", group_code: "5.2.09", type: "GASTO" },
  { code: "5.2.09.03", name: "Contribuciones", group_code: "5.2.09", type: "GASTO" },
  { code: "5.2.09.04", name: "Permiso de Funcionamiento", group_code: "5.2.09", type: "GASTO" },

  // 5.2.10 Seguros
  { code: "5.2.10.01", name: "Seguro", group_code: "5.2.10", type: "GASTO" },

  // 5.2.11 Gastos de Viaje
  { code: "5.2.11.01", name: "Hospedaje", group_code: "5.2.11", type: "GASTO" },
  { code: "5.2.11.02", name: "Alimentación Viaje", group_code: "5.2.11", type: "GASTO" },
  { code: "5.2.11.03", name: "Movilización Viaje", group_code: "5.2.11", type: "GASTO" },

  // 5.2.19 Otros Gastos
  { code: "5.2.19.01", name: "Alimentación Cafetería", group_code: "5.2.19", type: "GASTO" },

  // 5.4.01 Gastos Bancarios
  { code: "5.4.01.01", name: "Comisiones Bancarias", group_code: "5.4.01", type: "GASTO" },

  // 1.2.01 Propiedad, Planta y Equipo (Compras de Activo Fijo)
  { code: "1.2.01.01", name: "Equipos Médicos y Odontológicos", group_code: "1.2.01", type: "ACTIVO" },
  { code: "1.2.01.02", name: "Mobiliario y Enseres", group_code: "1.2.01", type: "ACTIVO" },
  { code: "1.2.01.03", name: "Equipos de Computación y Software", group_code: "1.2.01", type: "ACTIVO" },
];
