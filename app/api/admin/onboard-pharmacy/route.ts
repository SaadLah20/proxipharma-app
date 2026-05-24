export const runtime = "nodejs";

import { bearerTokenFromRequest, requireAdminSession } from "@/lib/admin-session";
import { onboardPharmacyAndPharmacist } from "@/lib/admin-onboard-pharmacy-server";
import { parseOnboardPharmacyBody } from "@/lib/admin-onboard-pharmacy";

/** Création officine + compte pharmacien (Auth téléphone + MDP provisoire, sans SMS). */
export async function POST(req: Request) {
  const token = bearerTokenFromRequest(req);
  const session = await requireAdminSession(token);
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: session.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const parsed = parseOnboardPharmacyBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = await onboardPharmacyAndPharmacist(session.admin, parsed.data, parsed.provisionalPassword);
  if (!outcome.ok) {
    return Response.json({ error: outcome.error }, { status: outcome.status });
  }

  return Response.json({
    ok: true,
    ...outcome.result,
    message:
      "Officine et compte pharmacien créés. Communiquez le mot de passe provisoire au titulaire (affiché ci-dessous).",
  });
}
