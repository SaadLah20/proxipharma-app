import { createSupabaseServiceClient } from "@/lib/supabase-service";

type QueueRow = {
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
  pharmacies: { nom: string | null } | { nom: string | null }[] | null;
};

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

function requestPathForRole(role: string | null | undefined, requestId: string) {
  if (role === "pharmacien") {
    return `/dashboard/pharmacien/demandes/${requestId}`;
  }
  return `/dashboard/demandes/${requestId}`;
}

async function handleCron(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";

  if (!expected) {
    return Response.json({ ok: false, error: "Missing env var: CRON_SECRET" }, { status: 500 });
  }

  if (auth !== `Bearer ${expected}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const limit = 20;

  const { data: pending, error: pendingErr } = await supabase
    .from("notification_external_queue")
    .select("id,recipient_id,destination_snapshot,title,body,request_id,event_type,attempt_count,status")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pendingErr) {
    return Response.json({ ok: false, error: pendingErr.message }, { status: 500 });
  }

  const pendingRows = (pending ?? []) as unknown as QueueRow[];
  const remaining = Math.max(0, limit - pendingRows.length);
  let retryRows: QueueRow[] = [];

  if (remaining > 0) {
    const { data: failed, error: failedErr } = await supabase
      .from("notification_external_queue")
      .select("id,recipient_id,destination_snapshot,title,body,request_id,event_type,attempt_count,status")
      .eq("channel", "email")
      .eq("status", "failed")
      .lt("attempt_count", 3)
      .order("created_at", { ascending: true })
      .limit(remaining);

    if (failedErr) {
      return Response.json({ ok: false, error: failedErr.message }, { status: 500 });
    }
    retryRows = (failed ?? []) as unknown as QueueRow[];
  }

  const rows = [...pendingRows, ...retryRows];
  if (rows.length === 0) {
    return Response.json({ ok: true, processed: 0, sent: 0, failed: 0, retried: 0 });
  }

  // Mark as processing first to avoid double-send.
  const ids = rows.map((r) => r.id);
  const { error: lockErr } = await supabase
    .from("notification_external_queue")
    .update({ status: "processing" })
    .in("id", ids)
    .in("status", ["pending", "failed"])
    .lt("attempt_count", 3);
  if (lockErr) {
    return Response.json({ ok: false, error: lockErr.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const requestOrigin = process.env.APP_BASE_URL ?? new URL(req.url).origin;
  const recipientIds = [...new Set(rows.map((r) => r.recipient_id))];
  const requestIds = [...new Set(rows.map((r) => r.request_id))];
  const roleByRecipient = new Map<string, string>();
  const requestMetaById = new Map<string, { requestType: string | null; pharmacyName: string | null }>();

  if (recipientIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id,role").in("id", recipientIds);
    for (const p of profiles ?? []) {
      const row = p as { id: string; role: string | null };
      roleByRecipient.set(row.id, row.role ?? "patient");
    }
  }

  if (requestIds.length > 0) {
    const { data: reqRows } = await supabase
      .from("requests")
      .select("id,request_type,pharmacies(nom)")
      .in("id", requestIds);
    for (const raw of (reqRows ?? []) as unknown as RequestMeta[]) {
      const pharmacy = Array.isArray(raw.pharmacies) ? raw.pharmacies[0] : raw.pharmacies;
      requestMetaById.set(raw.id, {
        requestType: raw.request_type ?? null,
        pharmacyName: pharmacy?.nom ?? null,
      });
    }
  }

  for (const r of rows) {
    const to = r.destination_snapshot;
    const subject = r.title;
    const role = roleByRecipient.get(r.recipient_id);
    const requestLink = `${requestOrigin}${requestPathForRole(role, r.request_id)}`;
    const meta = requestMetaById.get(r.request_id);
    const pharmacyLabel = meta?.pharmacyName ?? "Pharmacie non renseignée";
    const requestTypeLabel = meta?.requestType ?? "non renseigné";
    const text = [
      r.body ?? "",
      "",
      `Pharmacie: ${pharmacyLabel}`,
      `Type de demande: ${requestTypeLabel}`,
      `Ouvrir la demande: ${requestLink}`,
      `Demande: ${r.request_id}`,
      `Type: ${r.event_type}`,
    ]
      .join("\n")
      .trim();

    try {
      const out = await sendEmailViaResend({ to, subject, text });
      sent++;
      await supabase
        .from("notification_external_queue")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: out.id ?? null,
          last_error: null,
        })
        .eq("id", r.id);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("notification_external_queue")
        .update({
          status: "failed",
          attempt_count: (r.attempt_count ?? 0) + 1,
          last_error: msg.slice(0, 2000),
        })
        .eq("id", r.id);
    }
  }

  return Response.json({ ok: true, processed: rows.length, sent, failed, retried: retryRows.length });
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

