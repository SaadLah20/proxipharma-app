import { supabase } from "@/lib/supabase";

/** Compte admin ou patient pilote : annuaire inclut les officines non listées publiquement. */
export async function annuaireIncludesNonPublicPharmacies(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user?.id;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,pilot_access")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return false;
  return profile.role === "admin" || profile.pilot_access === true;
}
