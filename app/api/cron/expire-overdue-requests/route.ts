import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Défaut 24 h (`20260523_001`). Surcharge : `EXPIRE_RESPONDED_SILENCE` (ex. `30 minutes` en test). */
function respondedSilenceInterval(): string {
  const raw = process.env.EXPIRE_RESPONDED_SILENCE?.trim();
  if (raw) return raw;
  return "24 hours";
}

function plannedVisitDayReminderHour(): number {
  const raw = process.env.PLANNED_VISIT_DAY_REMINDER_HOUR?.trim();
  if (!raw) return 10;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(23, n));
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
  const silence = respondedSilenceInterval();
  const dayReminderHour = plannedVisitDayReminderHour();

  const { data, error } = await supabase.rpc("expire_overdue_requests", {
    p_responded_silence: silence,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: reminded, error: remindError } = await supabase.rpc("remind_unvalidated_responded_requests", {
    p_responded_silence: silence,
    p_reminder_before: "4 hours",
  });

  if (remindError) {
    return Response.json({ ok: false, error: remindError.message }, { status: 500 });
  }

  const { data: pharmaReminded, error: pharmaRemindError } = await supabase.rpc(
    "remind_pharmacist_responded_expiry",
    {
      p_responded_silence: silence,
      p_reminder_before: "1 hour",
    },
  );

  if (pharmaRemindError) {
    return Response.json({ ok: false, error: pharmaRemindError.message }, { status: 500 });
  }

  const { data: visitReminded, error: visitRemindError } = await supabase.rpc("remind_planned_visit_passage", {
    p_day_reminder_hour: dayReminderHour,
  });

  if (visitRemindError) {
    return Response.json({ ok: false, error: visitRemindError.message }, { status: 500 });
  }

  const { data: pickupMissed, error: pickupMissedError } = await supabase.rpc("alert_pharmacist_pickup_missed");

  if (pickupMissedError) {
    return Response.json({ ok: false, error: pickupMissedError.message }, { status: 500 });
  }

  const { data: abandonedPickup, error: abandonError } = await supabase.rpc("abandon_overdue_pickup_requests");

  if (abandonError) {
    return Response.json({ ok: false, error: abandonError.message }, { status: 500 });
  }

  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return Response.json({
    ok: true,
    expiredCount: num(data),
    remindedCount: num(reminded),
    pharmaRemindedCount: num(pharmaReminded),
    visitRemindedCount: num(visitReminded),
    pickupMissedAlertCount: num(pickupMissed),
    abandonedPickupCount: num(abandonedPickup),
    silence,
    dayReminderHour,
  });
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
