import type { AnnuairePharmacyRow } from "@/lib/annuaire/types";
import { supabase } from "@/lib/supabase";

/** Compte admin ou patient pilote : annuaire inclut les officines non listées publiquement. */
export async function annuaireIncludesNonPublicPharmacies(): Promise<boolean> {
  // getUser() valide le JWT côté serveur (getSession() peut rester « connecté » sur mobile).
  const { data: auth, error } = await supabase.auth.getUser();
  const userId = !error ? auth.user?.id : undefined;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,pilot_access")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return false;
  return profile.role === "admin" || profile.pilot_access === true;
}

/** Filtre filet : officines visibles annuaire grand public. */
export function annuairePublicListedOnly(rows: AnnuairePharmacyRow[]): AnnuairePharmacyRow[] {
  return rows.filter((p) => p.public_listed === true);
}
