import type { User } from "@supabase/supabase-js";

/** Compte pharmacien créé par l’admin (sans OTP SMS). */
export const PROVISIONED_PHARMACIST_META = "provisioned_by_admin";

export function userIsProvisionedPharmacist(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.user_metadata?.[PROVISIONED_PHARMACIST_META] === true;
}
