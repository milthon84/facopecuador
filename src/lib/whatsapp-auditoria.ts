import type { SupabaseClient } from "@supabase/supabase-js";
import { ecuadorDateOf, ecuadorDateTimeLabel, ecuadorRangeToUtc } from "@/lib/ecuador-time";

export interface ThreadMessage {
  id: string;
  created_at: string;
  time_label: string; // "YYYY-MM-DD HH:mm" en hora Ecuador
  sender: "ASESOR" | "PACIENTE/CLIENTE";
  is_asesor: boolean;
  content: string;
  tipo_mensaje: string | null;
}

export interface GroupedWhatsAppChat {
  id: string;
  patient_name: string;
  phone: string;
  agent_name: string;
  channel: string;
  chat_date: string; // fecha Ecuador YYYY-MM-DD del primer mensaje
  started_at: string;
  ended_at: string;
  messages_count: number;
  transcript: string;
  messages: ThreadMessage[];
  created_at: string;
}

const PAGE_SIZE = 1000;
const MAX_MESSAGES = 200000; // Tope de seguridad

/**
 * Trae TODOS los mensajes de whatsapp_mensajes dentro del rango Ecuador [startDate, endDate]
 * paginando en bloques de 1000 (límite por defecto de PostgREST).
 */
async function fetchMessagesInRange(
  supabase: SupabaseClient,
  startDate?: string | null,
  endDate?: string | null
): Promise<any[]> {
  const all: any[] = [];
  let from = 0;

  while (from < MAX_MESSAGES) {
    let query = supabase
      .from("whatsapp_mensajes")
      .select("id, message_id, telefono, nombre_contacto, es_asesor, mensaje, tipo_mensaje, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (startDate && endDate) {
      const { fromIso, toExclusiveIso } = ecuadorRangeToUtc(startDate, endDate);
      query = query.gte("created_at", fromIso).lt("created_at", toExclusiveIso);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

/**
 * Consulta whatsapp_mensajes en Supabase, agrupa los mensajes por teléfono (una conversación por número)
 * y devuelve los chats ordenados del más reciente (último mensaje) al más antiguo.
 * Todas las fechas y horas se expresan en hora de Ecuador.
 */
export async function getWhatsAppGroupedChats(
  supabase: SupabaseClient,
  startDate?: string | null,
  endDate?: string | null
): Promise<GroupedWhatsAppChat[]> {
  try {
    const rawMessages = await fetchMessagesInRange(supabase, startDate, endDate);
    if (rawMessages.length === 0) return [];

    const phoneGroups: Record<string, any[]> = {};
    for (const msg of rawMessages) {
      const phone = (msg.telefono || "SinNúmero").trim();
      if (!phoneGroups[phone]) phoneGroups[phone] = [];
      phoneGroups[phone].push(msg);
    }

    const groupedChats: GroupedWhatsAppChat[] = [];

    for (const [phone, msgs] of Object.entries(phoneGroups)) {
      if (msgs.length === 0) continue;

      // Ya vienen ordenados por created_at ascendente desde la consulta
      const validName = msgs.find(
        (m) => m.nombre_contacto && m.nombre_contacto.trim().length > 0 && m.nombre_contacto !== "Desconocido"
      )?.nombre_contacto;
      const contactName = validName ? validName.trim() : `Contacto ${phone}`;

      const messages: ThreadMessage[] = msgs.map((m) => {
        const isAsesor = !!m.es_asesor;
        return {
          id: String(m.id),
          created_at: m.created_at,
          time_label: ecuadorDateTimeLabel(m.created_at),
          sender: isAsesor ? "ASESOR" : "PACIENTE/CLIENTE",
          is_asesor: isAsesor,
          content: (m.mensaje || "").trim() || "(Archivo multimedia / audio / imagen)",
          tipo_mensaje: m.tipo_mensaje || null,
        };
      });

      const transcript = messages.map((m) => `[${m.time_label}] [${m.sender}]: ${m.content}`).join("\n");
      const firstMsg = msgs[0];
      const lastMsg = msgs[msgs.length - 1];

      groupedChats.push({
        id: `wa_${phone}_${new Date(firstMsg.created_at).getTime()}`,
        patient_name: contactName,
        phone,
        agent_name: "Recepción / Asesor FACOP",
        channel: "whatsapp",
        chat_date: ecuadorDateOf(firstMsg.created_at),
        started_at: firstMsg.created_at,
        ended_at: lastMsg.created_at,
        messages_count: msgs.length,
        transcript,
        messages,
        created_at: firstMsg.created_at,
      });
    }

    // Orden descendente por último mensaje (lo más reciente arriba)
    groupedChats.sort((a, b) => new Date(b.ended_at).getTime() - new Date(a.ended_at).getTime());
    return groupedChats;
  } catch (err) {
    console.warn("Error al procesar agrupamiento de whatsapp_mensajes:", err);
    return [];
  }
}
