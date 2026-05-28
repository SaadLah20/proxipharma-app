import { createClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

const ACTIVE_REQUEST_STATUSES = ["submitted", "in_review", "responded", "confirmed", "treated"] as const;
const ACTIVE_PROMO_STATUSES = ["submitted", "confirmed"] as const;

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Session requise." }, { status: 401 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token);

  if (userErr || !user) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return Response.json({ error: profileErr.message }, { status: 500 });
  }
  if ((profile as { role?: string } | null)?.role !== "patient") {
    return Response.json({ error: "Action réservée aux comptes patient." }, { status: 403 });
  }

  const { count: activeRequests, error: reqErr } = await admin
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", user.id)
    .in("status", [...ACTIVE_REQUEST_STATUSES]);

  if (reqErr) {
    return Response.json({ error: reqErr.message }, { status: 500 });
  }

  const { count: activePromos, error: promoErr } = await admin
    .from("pharmacy_promo_reservations")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", user.id)
    .in("status", [...ACTIVE_PROMO_STATUSES]);

  if (promoErr) {
    return Response.json({ error: promoErr.message }, { status: 500 });
  }

  if ((activeRequests ?? 0) > 0 || (activePromos ?? 0) > 0) {
    return Response.json(
      {
        error:
          "Impossible de supprimer le compte tant qu’un dossier ou une réservation promo est encore en cours. Terminez ou annulez-les d’abord.",
        code: "active_items",
      },
      { status: 409 }
    );
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return Response.json({ error: deleteErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
