import Link from "next/link";
import type { RequestKindConfig } from "@/lib/request-kinds/types";

type RequestDetailBackLinkProps = {
  config: RequestKindConfig;
  viewerRole: "patient" | "pharmacien";
};

export function RequestDetailBackLink({ config, viewerRole }: RequestDetailBackLinkProps) {
  const href = viewerRole === "patient" ? config.routes.patientHubPath : config.routes.pharmacistHubPath;
  const label = viewerRole === "patient" ? config.copy.patientHubTitle : config.copy.pharmacistHubTitle;
  const linkClass =
    viewerRole === "patient" ? config.theme.patientBackLinkClass : config.theme.pharmacistBackLinkClass;

  return (
    <Link href={href} className={`inline-block text-xs font-medium underline ${linkClass}`}>
      ← Retour — {label}
    </Link>
  );
}
