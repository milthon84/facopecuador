export interface FacturaRecibida {
  clave_acceso: string;
  ruc_emisor: string | null;
  razon_social: string | null;
  numero_comprobante: string | null;
  fecha_emision: string | null;
  fecha_autorizacion?: string | null;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  estado_facop: string; // 'pendiente' | 'registrado' | 'ignorado'
  expense_id?: string | null;
  created_at?: string;
}

export interface ExpenseItem {
  id?: string;
  expense_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  iva_rate: number; // 15 o 0
  subtotal: number;
  iva_amount: number;
  total: number;
}

export interface ExpenseItemRow {
  id: string; // id temporal en cliente (e.g. "row-1")
  description: string;
  quantity: number | string;
  unit_price: number | string;
  iva_rate: 0 | 15;
}

export function calculateItemRow(row: ExpenseItemRow) {
  const qty = Number(row.quantity) || 0;
  const price = Number(row.unit_price) || 0;
  const subtotal = Math.round(qty * price * 100) / 100;
  const iva = row.iva_rate === 15 ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
  const total = Math.round((subtotal + iva) * 100) / 100;
  return { qty, price, subtotal, iva, total };
}

export function calculateExpenseTotals(items: ExpenseItemRow[]) {
  let subtotal0 = 0;
  let subtotal15 = 0;
  let ivaAmount = 0;

  for (const item of items) {
    const { subtotal, iva } = calculateItemRow(item);
    if (item.iva_rate === 15) {
      subtotal15 += subtotal;
      ivaAmount += iva;
    } else {
      subtotal0 += subtotal;
    }
  }

  subtotal0 = Math.round(subtotal0 * 100) / 100;
  subtotal15 = Math.round(subtotal15 * 100) / 100;
  ivaAmount = Math.round(ivaAmount * 100) / 100;
  const total = Math.round((subtotal0 + subtotal15 + ivaAmount) * 100) / 100;

  return {
    subtotal0,
    subtotal15,
    ivaAmount,
    total,
    subtotal: Math.round((subtotal0 + subtotal15) * 100) / 100,
  };
}
