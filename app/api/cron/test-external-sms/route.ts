import { assertCronAuthorized, sendSmsViaTwilio } from "@/lib/external-notification-queue-worker";

/**
 * Test d’envoi SMS hors file (diagnostic Twilio).
 * POST + Authorization: Bearer CRON_SECRET
 * Body JSON optionnel : { "to": "+212...", "text": "Test Pharmeto" }
 */
async function handle(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  let to = process.env.SMS_TEST_TO?.trim() ?? "";
  let text = "Test Pharmeto — notification SMS (hors file).";

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { to?: string; text?: string };
      if (body.to?.trim()) to = body.to.trim();
      if (body.text?.trim()) text = body.text.trim();
    } catch {
      /* corps vide OK */
    }
  }

  if (!to) {
    return Response.json(
      {
        ok: false,
        error:
          "Indiquez un destinataire : body JSON { \"to\": \"+212...\" } ou variable SMS_TEST_TO sur Vercel.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendSmsViaTwilio({ to, text });
    return Response.json({
      ok: true,
      to,
      fromConfigured: Boolean(process.env.TWILIO_SMS_FROM?.trim()),
      messagingServiceConfigured: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        ok: false,
        error: msg,
        fromConfigured: Boolean(process.env.TWILIO_SMS_FROM?.trim()),
        messagingServiceConfigured: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()),
      },
      { status: 502 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
