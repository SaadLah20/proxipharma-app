import { authEmailRedirectUrl } from "@/lib/auth-site-url";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

export function normalizeAuthEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email.includes("@") || !email.includes(".")) return null;
  return email;
}

export function passwordResetRedirectUrl(req: Request): string {
  return authEmailRedirectUrl("/auth/update-password", new URL(req.url).origin);
}

/**
 * Envoie un e-mail de récupération Supabase Auth.
 * Si l'e-mail est dans `profiles` mais pas encore sur `auth.users` (inscription téléphone),
 * synchronise Auth puis déclenche l'envoi — cas typique des patients sans provider Email.
 */
export async function requestPasswordResetEmail(args: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const email = normalizeAuthEmail(args.email);
  if (!email) return;

  const supabase = createSupabaseServiceClient();

  const { data: profiles } = await supabase.from("profiles").select("id").eq("email", email).limit(2);

  const rows = profiles ?? [];
  if (rows.length === 1) {
    const userId = rows[0]!.id as string;
    const { data: authData, error: getErr } = await supabase.auth.admin.getUserById(userId);
    if (!getErr && authData.user) {
      const authEmail = authData.user.email?.trim().toLowerCase() ?? "";
      if (authEmail !== email) {
        await supabase.auth.admin.updateUserById(userId, {
          email,
          email_confirm: true,
        });
      }
    }
  }

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: args.redirectTo,
  });
}
