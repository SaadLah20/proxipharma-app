import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Défaut 24 h (`20260523_001`). Surcharge : `EXPIRE_RESPONDED_SILENCE` (ex. `30 minutes` en test). */
function respondedSilenceInterval(): string {
  const raw = process.env.EXPIRE_RESPONDED_SILENCE?.trim();
  if (raw) return raw;
  return "24 hours";
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

  const { data, error } = await supabase.rpc("expire_overdue_requests", {
    p_responded_silence: silence,
  });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const expiredCount = typeof data === "number" ? data : Number(data);

  return Response.json({
    ok: true,
    expiredCount: Number.isFinite(expiredCount) ? expiredCount : 0,
    silence,
  });
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
