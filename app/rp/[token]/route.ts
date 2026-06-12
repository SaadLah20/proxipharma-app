import { NextResponse } from "next/server";
import { patientRequestDetailPath } from "@/lib/pharmacist-patient-crm";
import { isValidSmsRequestShortToken, requestIdFromSmsToken } from "@/lib/sms-request-short-link";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function appOrigin(req: Request): string {
  return (process.env.APP_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
}

/**
 * Redirection lien court pharmacien : /rp/{uuid32hex} → détail dossier officine.
 */
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const origin = appOrigin(req);
  const { token: raw } = await ctx.params;
  const token = raw?.trim().toLowerCase() ?? "";

  if (!isValidSmsRequestShortToken(token)) {
    return NextResponse.redirect(`${origin}/dashboard/pharmacien/demandes`, 302);
  }

  const requestId = requestIdFromSmsToken(token);
  if (!requestId) {
    return NextResponse.redirect(`${origin}/dashboard/pharmacien/demandes`, 302);
  }

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id,request_type")
    .eq("id", requestId)
    .maybeSingle();

  if (error || !data?.id) {
    return NextResponse.redirect(`${origin}/dashboard/pharmacien/demandes`, 302);
  }

  const detailPath = patientRequestDetailPath(String(data.request_type ?? "product_request"), data.id);
  return NextResponse.redirect(`${origin}${detailPath}`, 302);
}
