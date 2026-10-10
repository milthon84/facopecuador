import { SupabaseClient } from "@supabase/supabase-js";

export interface GroupedWhatsAppChat {
  id: string;
  patient_name: string;
  phone: string;
  agent_name: string;
  channel: string;
  chat_date: string;
  started_at: string;
  ended_at: string;
  messages_count: number;
  transcript: string;
  created_at: string;
}

/**
 * Consulta la tabla whatsapp_mensajes en Supabase y agrupa los mensajes por teléfono / sesión
 * para alimentar las auditorías de calidad con Inteligencia Artificial.
 */
export async function getWhatsAppGroupedChats(
  supabase: SupabaseClient,
  startDate?: string | null,
  endDate?: string | null,
  limit: number = 100
): Promise<GroupedWhatsAppChat[]> {
  try {
    let query = supabase
      .from("whatsapp_mensajes")
      .select("id, message_id, telefono, nombre_contacto, es_asesor, mensaje, tipo_mensaje, created_at")
      .order("created_at", { ascending: true })
      .limit(limit * 30); // Permite traer hasta varios cientos de mensajes para agrupar

    if (startDate) {
      query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
    }

    const { data: rawMessages, error } = await query;
    if (error || !rawMessages || rawMessages.length === 0) {
      // Si la tabla whatsapp_mensajes no existe o está vacía, retornar vacío sin romper
      return [];
    }

    // Agrupar mensajes por número de teléfono
    const phoneGroups: Record<string, typeof rawMessages> = {};
    for (const msg of rawMessages) {
      const phone = (msg.telefono || "SinNúmero").trim();
      if (!phoneGroups[phone]) {
        phoneGroups[phone] = [];
      }
      phoneGroups[phone].push(msg);
    }

    const groupedChats: GroupedWhatsAppChat[] = [];

    for (const [phone, msgs] of Object.entries(phoneGroups)) {
      if (!msgs || msgs.length === 0) continue;

      // Ordenar por fecha cronológica ascendente
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Obtener el nombre del contacto más representativo
      const validName = msgs.find(
        (m) => m.nombre_contacto && m.nombre_contacto.trim().length > 0 && m.nombre_contacto !== "Desconocido"
      )?.nombre_contacto;
      const contactName = validName ? validName.trim() : `Contacto ${phone}`;

      // Construir transcripción legible para la IA
      const lines = msgs.map((m) => {
        const d = new Date(m.created_at);
        const timeStr = d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
        const dateStr = d.toISOString().slice(0, 10);
        const sender = m.es_asesor ? "ASESOR" : "PACIENTE/CLIENTE";
        const content = (m.mensaje || "").trim() || "(Archivo multimedia / audio / imagen)";
        return `[${dateStr} ${timeStr}] [${sender}]: ${content}`;
      });

      const firstMsg = msgs[0];
      const lastMsg = msgs[msgs.length - 1];
      const chatDate = firstMsg.created_at ? firstMsg.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10);

      groupedChats.push({
        id: `wa_${phone}_${new Date(firstMsg.created_at).getTime()}`,
        patient_name: contactName,
        phone: phone,
        agent_name: "Recepción / Asesor FACOP",
        channel: "whatsapp",
        chat_date: chatDate,
        started_at: firstMsg.created_at,
        ended_at: lastMsg.created_at,
        messages_count: msgs.length,
        transcript: lines.join("\n"),
        created_at: firstMsg.created_at,
      });
    }

    // Ordenar los chats más recientes primero
    groupedChats.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    return groupedChats.slice(0, limit);
  } catch (err) {
    console.warn("Error al procesar agrupamiento de whatsapp_mensajes:", err);
    return [];
  }
}
