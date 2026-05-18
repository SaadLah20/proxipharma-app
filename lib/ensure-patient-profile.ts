import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function authEmailForProfile(user: User): string | null {
  const e = user.email?.trim();
  if (!e) return null;
  if (e.endsWith("@anonymous.invalid")) return null;
  return e;
}

/**
 * Garantit une ligne `profiles` pour un patient après connexion (OTP téléphone ou e-mail).
 * Ne modifie pas les rôles pharmacien / admin.
 */
export async function ensurePatientProfile(
  user: User,
  overrides?: { full_name?: string; whatsapp?: string; email?: string }
): Promise<{ error: Error | null }> {
  const full_name =
    overrides?.full_name?.trim() ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
    null;
  const whatsapp =
    overrides?.whatsapp?.trim() ||
    (typeof user.user_metadata?.whatsapp === "string" ? user.user_metadata.whatsapp.trim() : "") ||
    user.phone?.trim() ||
    null;
  const overrideEmail = overrides?.email?.trim().toLowerCase();
  const email =
    (overrideEmail && overrideEmail.includes("@") ? overrideEmail : null) || authEmailForProfile(user);

  const { data: row, error: selErr } = await supabase
    .from("profiles")
    .select("id,role,email")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) {
    return { error: new Error(selErr.message) };
  }

  const role = (row as { role?: string } | null)?.role;
  if (role && role !== "patient") {
    return { error: null };
  }

  if (!row) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name,
      whatsapp,
      email,
      role: "patient",
    });
    return { error: error ? new Error(error.message) : null };
  }

  const patch: Record<string, string | null> = {};
  if (full_name) patch.full_name = full_name;
  if (whatsapp) patch.whatsapp = whatsapp;
  if (email) patch.email = email;

  if (Object.keys(patch).length === 0) {
    return { error: null };
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  return { error: error ? new Error(error.message) : null };
}
