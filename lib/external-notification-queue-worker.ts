import type { SupabaseClient } from "@supabase/supabase-js";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { appendSmsRequestLinkIfEnabled } from "@/lib/sms-request-short-link";

export type ExternalNotificationChannel = "email" | "sms";

/** SMS pilote patient : événements à fort impact métier. */
export const SMS_PATIENT_EVENT_TYPES = new Set<string>([
  "request_status:responded",
  "request_status:treated",
  "request_status:expired",
  "request_event:post_confirm_product_arrived",
  "request_event:market_shortage_product_available",
  "request_event:responded_expiry_reminder",
]);

function trimSmsSegment(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** Nom affiché SMS : évite « La pharmacie Pharmacie X ». */
export function smsPharmacyShortName(nom: string | null): string {
  const t = (nom ?? "Officine").trim();
  const stripped = t.replace(/^pharmacie\s+/i, "").trim();
  return stripped || t;
}

/** Ref dossier (D042/26) ou repli court UUID. */
export function smsRequestRefLabel(requestPublicRef: string | null | undefined, requestId: string): string {
  return displayRequestPublicRef({ request_public_ref: requestPublicRef, id: requestId });
}

export type QueueRow = {
  id: string;
  recipient_id: string;
  destination_snapshot: string;
  title: string;
  body: string | null;
  request_id: string;
  event_type: string;
  attempt_count: number;
  status: "pending" | "processing" | "sent" | "failed";
};

type RequestMeta = {
  id: string;
  request_type: string | null;
  request_public_ref: string | null;
  pharmacies: { nom: string | null } | { nom: string | null }[] | null;
};

export type ProcessQueueResult = {
  ok: true;
  channel: ExternalNotificationChannel;
  processed: number;
  sent: number;
  failed: number;
  retried: number;
};

function requestPathForRole(role: string | null | undefined, requestId: string) {
  if (role === "pharmacien") {
    return `/dashboard/pharmacien/demandes/${requestId}`;
  }
  return `/dashboard/demandes/${requestId}`;
}

export function buildOutboundNotificationText(args: {
  row: QueueRow;
  requestOrigin: string;
  role: string | null | undefined;
  pharmacyName: string | null;
  requestType: string | null;
  requestPublicRef?: string | null;
  channel: ExternalNotificationChannel;
}): { subject: string; text: string } {
  const subject = args.row.title;
  const requestLink = `${args.requestOrigin}${requestPathForRole(args.role, args.row.request_id)}`;
  const pharmacyLabel = args.pharmacyName ?? "Pharmacie";
  const bodyLine = (args.row.body ?? "").trim();

  if (args.channel === "sms") {
    const pharma = trimSmsSegment(smsPharmacyShortName(pharmacyLabel), 28);
    const ref = trimSmsSegment(smsRequestRefLabel(args.requestPublicRef, args.row.request_id), 16);
    // ASCII sans accents : 1 segment GSM, évite « r pondu » / « trait » sur livraison MA.
    let text: string;
    if (args.row.event_type === "request_status:responded") {
      text = `ProxiPharma: ${pharma} a repondu. Dossier ${ref}.`;
    } else if (args.row.event_type === "request_status:treated") {
      text = `ProxiPharma: ${pharma} a traite le dossier ${ref}.`;
    } else if (args.row.event_type === "request_status:expired") {
      text = `ProxiPharma: delai depasse dossier ${ref}.`;
    } else if (args.row.event_type === "request_event:post_confirm_product_arrived") {
      text = `ProxiPharma: produit recu chez ${pharma}. Dossier ${ref}.`;
    } else if (args.row.event_type === "request_event:market_shortage_product_available") {
      text = `ProxiPharma: produit dispo chez ${pharma}. Dossier ${ref}.`;
    } else if (args.row.event_type === "request_event:responded_expiry_reminder") {
      text = `ProxiPharma: rappel validation dossier ${ref} chez ${pharma}.`;
    } else {
      text = trimSmsSegment(`ProxiPharma - ${subject}`, 155);
    }
    text = appendSmsRequestLinkIfEnabled({
      text,
      requestOrigin: args.requestOrigin,
      requestId: args.row.request_id,
      eventType: args.row.event_type,
    });
    return { subject, text: trimSmsSegment(text, 155) };
  }

  const requestTypeLabel = args.requestType ?? "non renseigné";
  const text = [
    bodyLine,
    "",
    `Pharmacie: ${pharmacyLabel}`,
    `Type de demande: ${requestTypeLabel}`,
    `Ouvrir la demande: ${requestLink}`,
    `Demande: ${args.row.request_id}`,
    `Type: ${args.row.event_type}`,
  ]
    .join("\n")
    .trim();

  return { subject, text };
}

async function sendEmailViaResend(args: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

  if (!apiKey) {
    throw new Error("Missing env var: RESEND_API_KEY");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${raw}`);
  }

  try {
    return JSON.parse(raw) as { id?: string };
  } catch {
    return { id: undefined };
  }
}

/** Codes Twilio : ne pas retenter (facturation à chaque appel). */
const TWILIO_SMS_PERMANENT_ERROR_CODES = new Set([
  21211, 21214, 21217, 21219, 21408, 21601, 21602, 21604, 21606, 21607, 21608, 21610, 21611, 21612,
  21614, 30007, 30032, 30034, 30035,
]);

export function twilioSmsErrorLooksPermanent(errorMessage: string): boolean {
  const raw = errorMessage.trim();
  try {
    const j = JSON.parse(raw) as { code?: unknown };
    if (typeof j.code === "number" && TWILIO_SMS_PERMANENT_ERROR_CODES.has(j.code)) return true;
  } catch {
    /* corps Twilio parfois embarqué dans notre message */
  }
  const m = raw.match(/"code"\s*:\s*(\d+)/);
  if (m && TWILIO_SMS_PERMANENT_ERROR_CODES.has(Number(m[1]))) return true;
  return false;
}

function maxAttemptsForChannel(channel: ExternalNotificationChannel): number {
  return channel === "sms" ? 1 : 3;
}

/** Numéros à ne jamais appeler (Vercel : SMS_BLOCKED_DESTINATIONS=+212600000123,…). */
function loadSmsBlockedDestinations(): Set<string> {
  const blocked = new Set<string>();
  for (const raw of (process.env.SMS_BLOCKED_DESTINATIONS ?? "").split(",")) {
    const bit = raw.trim();
    if (!bit) continue;
    const e164 = normalizePhoneToE164(bit) ?? bit;
    blocked.add(e164);
    blocked.add(e164.replace(/\D/g, ""));
  }
  return blocked;
}

function isSmsDestinationBlocked(destination: string, blocked: Set<string>): boolean {
  if (blocked.size === 0) return false;
  const e164 = normalizePhoneToE164(destination) ?? destination.trim();
  const digits = e164.replace(/\D/g, "");
  if (blocked.has(e164) || blocked.has(digits)) return true;
  for (const b of blocked) {
    if (b.replace(/\D/g, "") === digits) return true;
  }
  return false;
}

type TwilioMessageResource = {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  from?: string | null;
  to?: string | null;
  messaging_service_sid?: string | null;
};

export type SmsDispatchResult = {
  id?: string;
  twilioStatus?: string;
  twilioFrom?: string | null;
  twilioMeta?: TwilioMessageResource;
};

/** Envoi SMS direct (tests / cron) — API Messages + numéro acheté (`TWILIO_SMS_FROM`), pas Twilio Verify. */
export async function sendSmsViaTwilio(args: { to: string; text: string }): Promise<SmsDispatchResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken) {
    throw new Error("Missing env vars: TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN");
  }
  if (!from && !messagingServiceSid) {
    throw new Error("Missing env var: TWILIO_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID");
  }

  const to = normalizePhoneToE164(args.to) ?? args.to.trim();
  if (!to.startsWith("+")) {
    throw new Error(`Invalid SMS destination (E.164 required): ${args.to}`);
  }

  const body = new URLSearchParams();
  body.set("To", to);
  body.set("Body", args.text);
  if (from) {
    body.set("From", from);
  } else {
    body.set("MessagingServiceSid", messagingServiceSid!);
  }

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
    throw new Error(`Twilio SMS error ${res.status}: ${raw}`);
  }

  let parsed: TwilioMessageResource = {};
  try {
    parsed = JSON.parse(raw) as TwilioMessageResource;
  } catch {
    throw new Error(`Twilio SMS invalid JSON response: ${raw.slice(0, 500)}`);
  }

  const status = (parsed.status ?? "").toLowerCase();
  if (parsed.error_code != null && parsed.error_code !== 0) {
    throw new Error(
      `Twilio SMS error_code ${parsed.error_code}: ${parsed.error_message ?? "unknown"} (status=${status || "?"})`
    );
  }
  if (status === "failed" || status === "undelivered") {
    throw new Error(
      `Twilio SMS status ${status}: ${parsed.error_message ?? "delivery failed"} (sid=${parsed.sid ?? "?"})`
    );
  }

  return {
    id: parsed.sid,
    twilioStatus: parsed.status,
    twilioFrom: parsed.from ?? (from || null),
    twilioMeta: parsed,
  };
}

async function dispatchOutbound(
  channel: ExternalNotificationChannel,
  args: { destination: string; subject: string; text: string }
): Promise<SmsDispatchResult & { id?: string }> {
  if (channel === "email") {
    const out = await sendEmailViaResend({ to: args.destination, subject: args.subject, text: args.text });
    return { id: out.id };
  }
  return sendSmsViaTwilio({ to: args.destination, text: args.text });
}

export async function processExternalNotificationQueue(args: {
  supabase: SupabaseClient;
  channel: ExternalNotificationChannel;
  requestOrigin: string;
  limit?: number;
}): Promise<ProcessQueueResult> {
  const limit = args.limit ?? 20;
  const maxAttempts = maxAttemptsForChannel(args.channel);

  const { data: pending, error: pendingErr } = await args.supabase
    .from("notification_external_queue")
    .select("id,recipient_id,destination_snapshot,title,body,request_id,event_type,attempt_count,status")
    .eq("channel", args.channel)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pendingErr) {
    throw new Error(pendingErr.message);
  }

  const pendingRows = (pending ?? []) as unknown as QueueRow[];
  const remaining = Math.max(0, limit - pendingRows.length);
  let retryRows: QueueRow[] = [];

  if (remaining > 0 && maxAttempts > 1) {
    const { data: failed, error: failedErr } = await args.supabase
      .from("notification_external_queue")
      .select("id,recipient_id,destination_snapshot,title,body,request_id,event_type,attempt_count,status")
      .eq("channel", args.channel)
      .eq("status", "failed")
      .lt("attempt_count", maxAttempts)
      .order("created_at", { ascending: true })
      .limit(remaining);

    if (failedErr) {
      throw new Error(failedErr.message);
    }
    retryRows = (failed ?? []) as unknown as QueueRow[];
  }

  const rows = [...pendingRows, ...retryRows];
  if (rows.length === 0) {
    return { ok: true, channel: args.channel, processed: 0, sent: 0, failed: 0, retried: 0 };
  }

  const ids = rows.map((r) => r.id);
  const { error: lockErr } = await args.supabase
    .from("notification_external_queue")
    .update({ status: "processing" })
    .in("id", ids)
    .in("status", ["pending", "failed"])
    .lt("attempt_count", maxAttempts);
  if (lockErr) {
    throw new Error(lockErr.message);
  }

  let sent = 0;
  let failed = 0;
  const recipientIds = [...new Set(rows.map((r) => r.recipient_id))];
  const requestIds = [...new Set(rows.map((r) => r.request_id))];
  const roleByRecipient = new Map<string, string>();
  const requestMetaById = new Map<
    string,
    { requestType: string | null; requestPublicRef: string | null; pharmacyName: string | null }
  >();

  if (recipientIds.length > 0) {
    const { data: profiles } = await args.supabase.from("profiles").select("id,role").in("id", recipientIds);
    for (const p of profiles ?? []) {
      const row = p as { id: string; role: string | null };
      roleByRecipient.set(row.id, row.role ?? "patient");
    }
  }

  if (requestIds.length > 0) {
    const { data: reqRows } = await args.supabase
      .from("requests")
      .select("id,request_type,request_public_ref,pharmacies(nom)")
      .in("id", requestIds);
    for (const raw of (reqRows ?? []) as unknown as RequestMeta[]) {
      const pharmacy = Array.isArray(raw.pharmacies) ? raw.pharmacies[0] : raw.pharmacies;
      requestMetaById.set(raw.id, {
        requestType: raw.request_type ?? null,
        requestPublicRef: raw.request_public_ref ?? null,
        pharmacyName: pharmacy?.nom ?? null,
      });
    }
  }

  const smsBlocked = args.channel === "sms" ? loadSmsBlockedDestinations() : new Set<string>();

  for (const r of rows) {
    if (args.channel === "sms" && roleByRecipient.get(r.recipient_id) !== "patient") {
      failed++;
      await args.supabase
        .from("notification_external_queue")
        .update({
          status: "failed",
          attempt_count: maxAttempts,
          last_error: "skipped: SMS réservé aux patients",
        })
        .eq("id", r.id);
      continue;
    }

    if (args.channel === "sms" && !SMS_PATIENT_EVENT_TYPES.has(r.event_type)) {
      failed++;
      await args.supabase
        .from("notification_external_queue")
        .update({
          status: "failed",
          attempt_count: maxAttempts,
          last_error: "skipped: SMS pilote limité à répondu / traité patient",
        })
        .eq("id", r.id);
      continue;
    }

    if (args.channel === "sms" && isSmsDestinationBlocked(r.destination_snapshot, smsBlocked)) {
      failed++;
      await args.supabase
        .from("notification_external_queue")
        .update({
          status: "failed",
          attempt_count: maxAttempts,
          last_error: "skipped: blocked destination (SMS_BLOCKED_DESTINATIONS)",
        })
        .eq("id", r.id);
      continue;
    }

    const role = roleByRecipient.get(r.recipient_id);
    const meta = requestMetaById.get(r.request_id);
    const { subject, text } = buildOutboundNotificationText({
      row: r,
      requestOrigin: args.requestOrigin,
      role,
      pharmacyName: meta?.pharmacyName ?? null,
      requestType: meta?.requestType ?? null,
      requestPublicRef: meta?.requestPublicRef ?? null,
      channel: args.channel,
    });

    try {
      const out = await dispatchOutbound(args.channel, {
        destination: r.destination_snapshot,
        subject,
        text,
      });
      sent++;
      const updateRow: {
        status: string;
        sent_at: string;
        provider_message_id: string | null;
        last_error: null;
        payload?: Record<string, unknown>;
      } = {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: out.id ?? null,
        last_error: null,
      };
      if (args.channel === "sms") {
        const smsOut = out as SmsDispatchResult;
        updateRow.payload = {
          twilio_status: smsOut.twilioStatus ?? null,
          twilio_from: smsOut.twilioFrom ?? null,
          twilio: smsOut.twilioMeta ?? null,
        };
      }
      await args.supabase.from("notification_external_queue").update(updateRow).eq("id", r.id);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      const prev = r.attempt_count ?? 0;
      const bump =
        args.channel === "sms" && twilioSmsErrorLooksPermanent(msg)
          ? maxAttempts
          : Math.min(maxAttempts, prev + 1);
      await args.supabase
        .from("notification_external_queue")
        .update({
          status: "failed",
          attempt_count: bump,
          last_error: msg.slice(0, 2000),
        })
        .eq("id", r.id);
    }
  }

  return {
    ok: true,
    channel: args.channel,
    processed: rows.length,
    sent,
    failed,
    retried: retryRows.length,
  };
}

export function assertCronAuthorized(req: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!expected) {
    return Response.json({ ok: false, error: "Missing env var: CRON_SECRET" }, { status: 500 });
  }

  if (auth !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
