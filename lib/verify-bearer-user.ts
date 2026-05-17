import type { User } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Valide le JWT patient/pharmacien via la clé service (route API Next). */
export async function verifyBearerUser(token: string): Promise<{ user: User | null; error: string | null }> {
  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      user: null,
      error: msg.includes("SERVICE_ROLE")
        ? "Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY)."
        : msg,
    };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error) {
    return { user: null, error: `Session invalide : ${error.message}` };
  }
  if (!data.user) {
    return { user: null, error: "Session expirée. Reconnectez-vous." };
  }
  return { user: data.user, error: null };
}
