import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { verifyBearerUser } from "@/lib/verify-bearer-user";

export function bearerTokenFromRequest(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

export type AdminSession =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; error: string; status: number };

/** Session JWT + rôle admin (lecture profil via service role). */
export async function requireAdminSession(token: string | null): Promise<AdminSession> {
  if (!token) {
    return { ok: false, error: "Non authentifié.", status: 401 };
  }

  const { user, error: authErr } = await verifyBearerUser(token);
  if (authErr || !user) {
    return { ok: false, error: authErr ?? "Session invalide.", status: 401 };
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, status: 500 };
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return { ok: false, error: profErr.message, status: 500 };
  }

  if ((profile as { role?: string } | null)?.role !== "admin") {
    return { ok: false, error: "Accès réservé aux administrateurs.", status: 403 };
  }

  return { ok: true, userId: user.id, admin };
}
