import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Vérifie si un numéro peut servir à une nouvelle inscription (pas déjà dans auth.users). */
export async function POST(req: Request) {
  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return Response.json({ available: false, error: "invalid_body" }, { status: 400 });
  }

  const e164 = normalizePhoneToE164(body.phone ?? "");
  if (!e164) {
    return Response.json({ available: false, error: "invalid_phone" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("auth_phone_user_exists", { p_phone: e164 });
    if (error) {
      return Response.json({ available: false, error: error.message }, { status: 500 });
    }
    const exists = data === true;
    return Response.json({ available: !exists, e164 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ available: false, error: msg }, { status: 500 });
  }
}
