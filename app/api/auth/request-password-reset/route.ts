import {
  normalizeAuthEmail,
  passwordResetRedirectUrl,
  requestPasswordResetEmail,
} from "@/lib/request-password-reset-server";

/** Récupération mot de passe : Auth + synchro e-mail depuis `profiles` si besoin. */
export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const email = normalizeAuthEmail(body.email ?? "");
  if (!email) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  try {
    await requestPasswordResetEmail({
      email,
      redirectTo: passwordResetRedirectUrl(req),
    });
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[request-password-reset]", msg);
    return Response.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
