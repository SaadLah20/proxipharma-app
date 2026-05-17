import { NextResponse } from "next/server";
import { isValidSmsRequestShortToken, requestIdFromSmsToken } from "@/lib/sms-request-short-link";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function appOrigin(req: Request): string {
  return (process.env.APP_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

/**
 * Redirection SMS : /r/{uuid32hex} → détail demande patient.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const origin = appOrigin(req);
  const { token: raw } = await ctx.params;
  const token = raw?.trim().toLowerCase() ?? "";

  if (!isValidSmsRequestShortToken(token)) {
    return NextResponse.redirect(`${origin}/dashboard/demandes`, 302);
  }

  const requestId = requestIdFromSmsToken(token);
  if (!requestId) {
    return NextResponse.redirect(`${origin}/dashboard/demandes`, 302);
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("requests").select("id").eq("id", requestId).maybeSingle();

  if (error || !data?.id) {
    return NextResponse.redirect(`${origin}/dashboard/demandes`, 302);
  }

  return NextResponse.redirect(`${origin}/dashboard/demandes/${data.id}`, 302);
}
