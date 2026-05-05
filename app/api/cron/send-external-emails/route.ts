import { createSupabaseServiceClient } from "@/lib/supabase-service";

type QueueRow = {
  id: string;
  destination_snapshot: string;
  title: string;
  body: string | null;
  request_id: string;
  event_type: string;
  attempt_count: number;
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

export async function POST(req: Request) {
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

  const { data: pending, error: qErr } = await supabase
    .from("notification_external_queue")
    .select("id,destination_snapshot,title,body,request_id,event_type,attempt_count")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (qErr) {
    return Response.json({ ok: false, error: qErr.message }, { status: 500 });
  }

  const rows = (pending ?? []) as unknown as QueueRow[];
  if (rows.length === 0) {
    return Response.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  // Mark as processing first to avoid double-send.
  const ids = rows.map((r) => r.id);
  const { error: lockErr } = await supabase
    .from("notification_external_queue")
    .update({ status: "processing" })
    .in("id", ids)
    .eq("status", "pending");
  if (lockErr) {
    return Response.json({ ok: false, error: lockErr.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const r of rows) {
    const to = r.destination_snapshot;
    const subject = r.title;
    const text = [r.body ?? "", "", `Demande: ${r.request_id}`, `Type: ${r.event_type}`].join("\n").trim();

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

  return Response.json({ ok: true, processed: rows.length, sent, failed });
}

