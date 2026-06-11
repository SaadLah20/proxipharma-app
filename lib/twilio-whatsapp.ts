import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { displayRequestPublicRef } from "@/lib/public-ref";

/** WhatsApp pilote patient P0 — modèles Utility Meta approuvés. */
export const WHATSAPP_PATIENT_EVENT_TYPES = new Set<string>([
  "request_status:responded",
  "request_status:treated",
]);

export type WhatsAppDispatchResult = {
  id?: string;
  twilioStatus?: string;
  twilioFrom?: string | null;
  contentSid?: string;
  twilioMeta?: Record<string, unknown>;
};

export function resolveWhatsAppContentSid(eventType: string): string | null {
  if (eventType === "request_status:responded") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_RESPONDED?.trim() ?? null;
  }
  if (eventType === "request_status:treated") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_TREATED?.trim() ?? null;
  }
  return null;
}

export function buildWhatsAppContentVariables(args: {
  pharmacyName: string | null;
  requestPublicRef: string | null;
  requestId: string;
}): Record<string, string> {
  const pharma = (args.pharmacyName ? pharmacyPublicLabel(args.pharmacyName) : "Pharmacie").trim();
  const ref = displayRequestPublicRef({
    request_public_ref: args.requestPublicRef,
    id: args.requestId,
  });
  return { "1": pharma, "2": ref };
}

/** Envoi WhatsApp business-initiated via Content Template (pas de body libre). */
export async function sendWhatsAppViaTwilio(args: {
  to: string;
  contentSid: string;
  contentVariables: Record<string, string>;
}): Promise<WhatsAppDispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (!accountSid || !authToken) {
    throw new Error("Missing env vars: TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN");
  }
  if (!from) {
    throw new Error("Missing env var: TWILIO_WHATSAPP_FROM");
  }
  if (!from.startsWith("whatsapp:")) {
    throw new Error("TWILIO_WHATSAPP_FROM must start with whatsapp: (ex. whatsapp:+212770165668)");
  }

  const toE164 = normalizePhoneToE164(args.to) ?? args.to.trim();
  if (!toE164.startsWith("+")) {
    throw new Error(`Invalid WhatsApp destination (E.164 required): ${args.to}`);
  }
  const to = toE164.startsWith("whatsapp:") ? toE164 : `whatsapp:${toE164}`;

  const body = new URLSearchParams();
  body.set("To", to);
  body.set("From", from);
  body.set("ContentSid", args.contentSid);
  body.set("ContentVariables", JSON.stringify(args.contentVariables));

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Twilio WhatsApp error ${res.status}: ${raw}`);
  }

  let parsed: {
    sid?: string;
    status?: string;
    error_code?: number | null;
    error_message?: string | null;
    from?: string | null;
  } = {};
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(`Twilio WhatsApp invalid JSON response: ${raw.slice(0, 500)}`);
  }

  const status = (parsed.status ?? "").toLowerCase();
  if (parsed.error_code != null && parsed.error_code !== 0) {
    throw new Error(
      `Twilio WhatsApp error_code ${parsed.error_code}: ${parsed.error_message ?? "unknown"} (status=${status || "?"})`
    );
  }
  if (status === "failed" || status === "undelivered") {
    throw new Error(
      `Twilio WhatsApp status ${status}: ${parsed.error_message ?? "delivery failed"} (sid=${parsed.sid ?? "?"})`
    );
  }

  return {
    id: parsed.sid,
    twilioStatus: parsed.status,
    twilioFrom: parsed.from ?? from,
    contentSid: args.contentSid,
    twilioMeta: parsed as Record<string, unknown>,
  };
}
