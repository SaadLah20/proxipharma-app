import { supabase } from "@/lib/supabase";

/** Destination après connexion si aucun `redirect` explicite dans l’URL. */
export async function defaultPathAfterAuth(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) return "/";
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role === "patient") return "/";
  if (role === "pharmacien") return "/dashboard/pharmacien";
  if (role === "admin") return "/admin";
  return "/";
}
