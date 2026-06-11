import {
  processExternalNotificationQueue,
  assertCronAuthorized,
  type ExternalNotificationChannel,
} from "@/lib/external-notification-queue-worker";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type SupabaseDbWebhookBody = {
  type?: string;
  table?: string;
  record?: { id?: string; channel?: string; status?: string };
};

function channelFromInsert(record: SupabaseDbWebhookBody["record"]): ExternalNotificationChannel | null {
  if (record?.status !== "pending") return null;
  if (record.channel === "sms" || record.channel === "email" || record.channel === "whatsapp") {
    return record.channel;
  }
  return null;
}

/**
 * Déclenchement rapide e-mail + SMS + WhatsApp (Supabase Database Webhook sur INSERT notification_external_queue).
 * POST + Authorization: Bearer CRON_SECRET
 * Traite la file du canal inséré (email, sms ou whatsapp).
 */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  let channel: ExternalNotificationChannel | null = null;
  let insertedQueueRowId: string | undefined;
  try {
    const body = (await req.json()) as SupabaseDbWebhookBody;
    if (body.type === "INSERT" && body.table === "notification_external_queue") {
      channel = channelFromInsert(body.record);
      insertedQueueRowId = body.record?.id?.trim() || undefined;
    }
  } catch {
    /* corps vide : traiter e-mail puis SMS (ping manuel) */
  }

  const supabase = createSupabaseServiceClient();
  const requestOrigin = process.env.APP_BASE_URL ?? new URL(req.url).origin;

  try {
    if (channel) {
      const result = await processExternalNotificationQueue({
        supabase,
        channel,
        requestOrigin,
        limit: insertedQueueRowId ? 1 : 10,
        onlyQueueRowIds: insertedQueueRowId ? [insertedQueueRowId] : undefined,
      });
      return Response.json(result);
    }

    const email = await processExternalNotificationQueue({
      supabase,
      channel: "email",
      requestOrigin,
      limit: 10,
    });
    const sms = await processExternalNotificationQueue({
      supabase,
      channel: "sms",
      requestOrigin,
      limit: 10,
    });
    const whatsapp = await processExternalNotificationQueue({
      supabase,
      channel: "whatsapp",
      requestOrigin,
      limit: 10,
    });
    return Response.json({ ok: true, email, sms, whatsapp });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
