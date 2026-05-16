import { processExternalNotificationQueue, assertCronAuthorized } from "@/lib/external-notification-queue-worker";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

async function handleCron(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  try {
    const supabase = createSupabaseServiceClient();
    const requestOrigin = process.env.APP_BASE_URL ?? new URL(req.url).origin;
    const result = await processExternalNotificationQueue({
      supabase,
      channel: "sms",
      requestOrigin,
    });
    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
