import { supabase } from "@/lib/supabase";

async function authBearerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function linkSignupPhoneOnAuth(e164: string): Promise<{ ok: boolean; error?: string }> {
  const token = await authBearerToken();
  if (!token) {
    return { ok: false, error: "Session introuvable." };
  }

  const res = await fetch("/api/auth/link-signup-phone", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ phone: e164 }),
  });

  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Impossible de lier le téléphone au compte." };
  }
  return { ok: true };
}

export async function syncPhoneBeforeLogin(
  phoneE164: string,
  password: string
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const res = await fetch("/api/auth/sync-phone-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: phoneE164, password }),
  });

  const json = (await res.json()) as { ok?: boolean; error?: string; code?: string };
  if (res.status === 404 || res.status === 401) {
    return { ok: false, error: json.error, code: json.code };
  }
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Synchronisation du téléphone impossible." };
  }
  return { ok: true };
}

export async function linkMyPhoneOnAuth(): Promise<{ ok: boolean; error?: string; phone?: string }> {
  const token = await authBearerToken();
  if (!token) {
    return { ok: false, error: "Session introuvable." };
  }

  const res = await fetch("/api/auth/link-my-phone", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = (await res.json()) as { ok?: boolean; error?: string; phone?: string };
  if (!res.ok) {
    return { ok: false, error: json.error ?? "Impossible d’activer la connexion par téléphone." };
  }
  return { ok: true, phone: json.phone };
}
