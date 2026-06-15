import { assertCronAuthorized } from "@/lib/external-notification-queue-worker";
import {
  buildWhatsAppContentVariables,
  resolveWhatsAppContentSid,
  sendWhatsAppViaTwilio,
} from "@/lib/twilio-whatsapp";

/**
 * Test d’envoi WhatsApp template hors file (diagnostic Twilio Content API).
 * POST + Authorization: Bearer CRON_SECRET
 * Body JSON optionnel :
 * {
 *   "to": "+212...",
 *   "eventType":
 *     "request_status:responded" | "request_status:treated" | "request_status:expired"
 *     | "request_status:confirmed"
 *     | "request_event:responded_expiry_reminder"
 *     | "request_event:post_confirm_product_arrived"
 *     | "request_event:market_shortage_product_available"
 *     | "request_event:planned_visit_day_reminder"
 *     | "request_event:planned_visit_pre_passage_reminder"
 *     | "request_status:submitted"
 *     | "request_event:planned_visit_passed_no_pickup"
 *     | "request_event:responded_expiry_pharmacist_reminder",
 *   "pharmacyName": "Pharmacie Centrale",
 *   "patientName": "Fatima B.",
 *   "requestRef": "D042/26"
 * }
 */
async function handle(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  let to = process.env.WHATSAPP_TEST_TO?.trim() ?? process.env.SMS_TEST_TO?.trim() ?? "";
  let eventType = "request_status:responded";
  let pharmacyName = "Pharmacie Centrale";
  let patientName = "Fatima B.";
  let requestRef = "D042/26";

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as {
        to?: string;
        eventType?: string;
        pharmacyName?: string;
        patientName?: string;
        requestRef?: string;
      };
      if (body.to?.trim()) to = body.to.trim();
      if (body.eventType?.trim()) eventType = body.eventType.trim();
      if (body.pharmacyName?.trim()) pharmacyName = body.pharmacyName.trim();
      if (body.patientName?.trim()) patientName = body.patientName.trim();
      if (body.requestRef?.trim()) requestRef = body.requestRef.trim();
    } catch {
      /* corps vide OK */
    }
  }

  if (!to) {
    return Response.json(
      {
        ok: false,
        error:
          'Indiquez un destinataire : body JSON { "to": "+212..." } ou variable WHATSAPP_TEST_TO / SMS_TEST_TO sur Vercel.',
      },
      { status: 400 }
    );
  }

  const contentSid = resolveWhatsAppContentSid(eventType);
  if (!contentSid) {
    return Response.json(
      {
        ok: false,
        error: `Content SID manquant pour ${eventType}. Définir TWILIO_WHATSAPP_CONTENT_SID_* sur Vercel (§10 RUNBOOK).`,
      },
      { status: 400 }
    );
  }

  const contentVariables = buildWhatsAppContentVariables({
    eventType,
    pharmacyName,
    patientName,
    requestPublicRef: requestRef,
    requestId: "00000000-0000-0000-0000-000000000000",
  });
  contentVariables["2"] = requestRef;

  try {
    const result = await sendWhatsAppViaTwilio({ to, contentSid, contentVariables });
    return Response.json({
      ok: true,
      to,
      eventType,
      contentSid,
      contentVariables,
      fromConfigured: Boolean(process.env.TWILIO_WHATSAPP_FROM?.trim()),
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        ok: false,
        error: msg,
        eventType,
        contentSid,
        fromConfigured: Boolean(process.env.TWILIO_WHATSAPP_FROM?.trim()),
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
