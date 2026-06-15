import type { SupabaseClient } from "@supabase/supabase-js";

/** Marque lues les alertes cloche liées au chat d’un dossier (sync avec ouverture conversation). */
export async function markConversationNotificationsReadForRequest(
  supabase: SupabaseClient,
  recipientId: string,
  requestId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await supabase
    .from("app_notifications")
    .update({ read_at: nowIso })
    .eq("recipient_id", recipientId)
    .eq("request_id", requestId)
    .is("read_at", null)
    .like("event_type", "request_conversation:%");
}
