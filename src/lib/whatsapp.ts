import { QuotationItem } from "@/lib/email";

export function buildQuotationWhatsAppUrl(
  phone: string | null | undefined,
  patientName: string,
  quotationNumber: string,
  items: QuotationItem[],
  total: number,
  notes?: string | null,
  discount?: number,
  paymentMethod?: string
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[\s\-().+]/g, "");
  let ecPhone = digits;
  if (digits.startsWith("0")) ecPhone = "593" + digits.slice(1);
  else if (digits.startsWith("9")) ecPhone = "593" + digits;

  const HAND = String.fromCodePoint(0x1F44B);   // 👋
  const TOOTH = String.fromCodePoint(0x1F9B7);  // 🦷
  const CLIP = String.fromCodePoint(0x1F4CB);   // 📋
  const MONEY = String.fromCodePoint(0x1F4B0);  // 💰
  const CAL = String.fromCodePoint(0x1F4C5);    // 📅
  const CARD = String.fromCodePoint(0x1F4B3);   // 💳

  const safeItems = Array.isArray(items) ? items : [];
  const subtotalVal = safeItems.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.quantity || 1) * Number(item.unitPrice || 0)) || 0), 0);
  const discVal = Number(discount || 0);

  const itemsList = safeItems.map(item => {
    const toothPart = item.tooth && item.tooth.trim() !== "" ? `Diente ${item.tooth}: ` : "";
    const qty = Number(item.quantity || 1);
    const unitP = Number(item.unitPrice || 0);
    const grossTotal = qty * unitP;
    const priceStr = qty > 1 ? `(${qty} x $${unitP.toFixed(2)}) – $${grossTotal.toFixed(2)} USD` : `($${grossTotal.toFixed(2)} USD)`;

    // Si hay descuento al contado, mostrar el porcentaje al final del ítem
    if (discVal > 0 && subtotalVal > 0) {
      const itemDisc = Math.round((grossTotal * (discVal / subtotalVal)) * 100) / 100;
      const pct = Math.round((itemDisc / grossTotal) * 100);
      const pctText = pct > 0 ? ` - ${pct}% desc.` : "";
      return `• ${toothPart}${item.treatment} ${priceStr}${pctText}`;
    }

    return `• ${toothPart}${item.treatment} ${priceStr}`;
  }).join("\n");

  const totalVal = (Number(total) || 0).toFixed(2);
  const payText = paymentMethod === "tarjeta" ? "Tarjeta de Crédito / Débito" : "Al Contado / Transferencia";

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://facop.com.ec").replace(/\/+$/, "");
  const bookingUrl = `${siteUrl}/cita-clinica`;

  let msg = `Hola *${patientName}* ${HAND}\n\n`;
  msg += `Adjuntamos tu presupuesto odontológico de *Facop Quito Clínica* ${TOOTH} (N° ${quotationNumber}):\n\n`;
  msg += `${CARD} *FORMA DE PAGO:* ${payText}\n\n`;
  msg += `${CLIP} *PROCEDIMIENTOS:*\n${itemsList}\n\n`;
  if (discVal > 0) {
    msg += `🏷️ *SUBTOTAL:* $${subtotalVal.toFixed(2)} USD\n`;
    msg += `🏷️ *DESCUENTO AL CONTADO:* -$${discVal.toFixed(2)} USD\n`;
  }
  msg += `${MONEY} *TOTAL:* $${totalVal} USD\n\n`;
  if (notes && notes.trim() !== "") {
    msg += `📝 *Observaciones:* ${notes.trim()}\n\n`;
  }
  msg += `${CAL} *Validez:* 30 días.\n\n`;
  msg += `🗓️ *Reserva tu cita directamente aquí:* ${bookingUrl}\n\n`;
  msg += `Quedamos a tu disposición para agendar tu cita o consultar facilidades de pago.`;

  return `https://api.whatsapp.com/send?phone=${ecPhone}&text=${encodeURIComponent(msg)}`;
}
