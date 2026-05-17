import { NextResponse } from "next/server";
import { isValidSmsRequestShortToken } from "@/lib/sms-request-short-link";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function appOrigin(req: Request): string {
  return (process.env.APP_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

/**
 * Redirection courte SMS : /r/{8hex} → détail demande patient.
 * Lookup par préfixe de `requests.id` (texte UUID).
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const origin = appOrigin(req);
  const { token: raw } = await ctx.params;
  const token = raw?.trim().toLowerCase() ?? "";

  if (!isValidSmsRequestShortToken(token)) {
    return NextResponse.redirect(`${origin}/dashboard/demandes`, 302);
  }

  const supabase = createSupabaseServiceClient();
  const { data: rows, error } = await supabase
    .from("requests")
    .select("id")
    .ilike("id", `${token}%`)
    .limit(2);

  if (error || !rows?.length || rows.length !== 1) {
    return NextResponse.redirect(`${origin}/dashboard/demandes`, 302);
  }

  return NextResponse.redirect(`${origin}/dashboard/demandes/${rows[0].id}`, 302);
}
