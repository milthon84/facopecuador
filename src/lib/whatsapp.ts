import { QuotationItem } from "@/lib/email";

export function buildQuotationWhatsAppUrl(
  phone: string | null | undefined,
  patientName: string,
  quotationNumber: string,
  items: QuotationItem[],
  total: number,
  notes?: string | null
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

  const itemsList = items.map(item => {
    const pStr = item.tooth ? `Diente ${item.tooth}` : "General";
    return `• ${pStr}: ${item.treatment} ($${item.subtotal.toFixed(2)})`;
  }).join("\n");

  let msg = `Hola *${patientName}* ${HAND}\n\n`;
  msg += `Adjuntamos tu presupuesto odontológico de *Facop Quito Clínica* ${TOOTH} (N° ${quotationNumber}):\n\n`;
  msg += `${CLIP} *TRATAMIENTOS:*\n${itemsList}\n\n`;
  msg += `${MONEY} *TOTAL ESTIMADO:* $${total.toFixed(2)} USD\n\n`;
  if (notes && notes.trim() !== "") {
    msg += `📝 *Observaciones:* ${notes.trim()}\n\n`;
  }
  msg += `${CAL} *Validez:* 30 días.\n`;
  msg += `Quedamos a tu disposición para agendar tu cita o consultar facilidades de pago.`;

  return `https://api.whatsapp.com/send?phone=${ecPhone}&text=${encodeURIComponent(msg)}`;
}
