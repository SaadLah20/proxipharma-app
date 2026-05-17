import type { User } from "@supabase/supabase-js";

type AuthUserJson = {
  id?: string;
  email?: string | null;
};

/**
 * Valide le JWT via l’API Auth Supabase (même mécanisme que le navigateur).
 * Évite admin.auth.getUser() côté Node qui peut échouer avec « fetch failed » en local.
 */
export async function verifyBearerUser(token: string): Promise<{ user: User | null; error: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { user: null, error: "Configuration Supabase manquante (URL ou clé anon)." };
  }

  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { user: null, error: `Impossible de joindre Supabase Auth (${msg}).` };
  }

  if (!res.ok) {
    return { user: null, error: "Session expirée. Reconnectez-vous." };
  }

  let json: AuthUserJson;
  try {
    json = (await res.json()) as AuthUserJson;
  } catch {
    return { user: null, error: "Réponse Auth invalide." };
  }

  if (!json.id) {
    return { user: null, error: "Session expirée. Reconnectez-vous." };
  }

  return {
    user: { id: json.id, email: json.email ?? undefined } as User,
    error: null,
  };
}
