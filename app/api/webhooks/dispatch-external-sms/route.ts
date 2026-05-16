import { processExternalNotificationQueue, assertCronAuthorized } from "@/lib/external-notification-queue-worker";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

type SupabaseDbWebhookBody = {
  type?: string;
  table?: string;
  record?: { channel?: string; status?: string };
};

/**
 * Déclenchement rapide SMS (Supabase Database Webhook sur INSERT notification_external_queue).
 * POST + Authorization: Bearer CRON_SECRET
 * Ne traite que si channel=sms et status=pending sur l’événement INSERT.
 */
export async function POST(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  let shouldRun = true;
  try {
    const body = (await req.json()) as SupabaseDbWebhookBody;
    if (body.type === "INSERT" && body.table === "notification_external_queue") {
      const rec = body.record;
      shouldRun = rec?.channel === "sms" && rec?.status === "pending";
    }
  } catch {
    /* corps vide : traiter la file (appel manuel / ping) */
  }

  if (!shouldRun) {
    return Response.json({ ok: true, skipped: true, reason: "not_sms_pending_insert" });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const requestOrigin = process.env.APP_BASE_URL ?? new URL(req.url).origin;
    const result = await processExternalNotificationQueue({
      supabase,
      channel: "sms",
      requestOrigin,
      limit: 10,
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
