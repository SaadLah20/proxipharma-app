import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { smsRequestShortToken } from "@/lib/sms-request-short-link";

/** WhatsApp pilote patient P0 — répondu (v2 link) + traité (v1). */
export const WHATSAPP_PATIENT_EVENT_TYPES = new Set<string>([
  "request_status:responded",
  "request_status:treated",
]);

/** WhatsApp pilote pharmacien C-pilote — nouvelle demande. */
export const WHATSAPP_PHARMACIST_EVENT_TYPES = new Set<string>(["request_status:submitted"]);

/** Modèles CTA Meta avec token lien court en variable {{3}}. */
export const WHATSAPP_LINK_EVENT_TYPES = new Set<string>([
  "request_status:responded",
  "request_status:submitted",
]);

export type WhatsAppDispatchResult = {
  id?: string;
  twilioStatus?: string;
  twilioFrom?: string | null;
  contentSid?: string;
  twilioMeta?: Record<string, unknown>;
};

export function isWhatsAppEventAllowed(args: { role: string | null | undefined; eventType: string }): boolean {
  if (args.role === "pharmacien") {
    return WHATSAPP_PHARMACIST_EVENT_TYPES.has(args.eventType);
  }
  return WHATSAPP_PATIENT_EVENT_TYPES.has(args.eventType);
}

export function resolveWhatsAppContentSid(eventType: string): string | null {
  if (eventType === "request_status:responded") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_RESPONDED?.trim() ?? null;
  }
  if (eventType === "request_status:treated") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_TREATED?.trim() ?? null;
  }
  if (eventType === "request_status:submitted") {
    return process.env.TWILIO_WHATSAPP_CONTENT_SID_PHARMACY_NEW_REQUEST?.trim() ?? null;
  }
  return null;
}

function trimWhatsAppPersonLabel(name: string, max = 44): string {
  const t = name.trim();
  if (!t) return "Client";
  return t.length <= max ? t : t.slice(0, max);
}

export function buildWhatsAppContentVariables(args: {
  eventType: string;
  pharmacyName?: string | null;
  patientName?: string | null;
  requestPublicRef: string | null;
  requestId: string;
}): Record<string, string> {
  const ref = displayRequestPublicRef({
    request_public_ref: args.requestPublicRef,
    id: args.requestId,
  });

  const vars: Record<string, string> = {};

  if (args.eventType === "request_status:submitted") {
    vars["1"] = trimWhatsAppPersonLabel(args.patientName ?? "Client");
    vars["2"] = ref;
  } else {
    const pharma = (args.pharmacyName ? pharmacyPublicLabel(args.pharmacyName) : "Pharmacie").trim();
    vars["1"] = pharma;
    vars["2"] = ref;
  }

  if (WHATSAPP_LINK_EVENT_TYPES.has(args.eventType)) {
    vars["3"] = smsRequestShortToken(args.requestId);
  }

  return vars;
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
