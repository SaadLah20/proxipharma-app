import { supabase } from "@/lib/supabase";

const EMBEDDED_BROWSER_HINT =
  "Session introuvable. Ouvrez l’app dans Chrome ou Edge (le navigateur intégré de Cursor ne conserve pas toujours la connexion Supabase).";

/**
 * Jeton d’accès pour les routes API Next (upload / URLs signées).
 * Préfère getUser + refreshSession à getSession seul (navigateurs embarqués IDE).
 */
export async function getBearerAccessTokenForApi(): Promise<{
  token: string | null;
  error: string | null;
}> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { token: null, error: EMBEDDED_BROWSER_HINT };
  }

  let token = (await supabase.auth.getSession()).data.session?.access_token ?? null;
  if (!token) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      return { token: null, error: refreshErr.message };
    }
    token = refreshed.session?.access_token ?? null;
  }

  if (!token) {
    return { token: null, error: "Session expirée. Reconnectez-vous." };
  }

  return { token, error: null };
}
