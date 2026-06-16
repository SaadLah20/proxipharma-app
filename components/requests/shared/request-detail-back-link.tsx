"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { hubPathForRequestKind } from "@/lib/request-hub-parcours";
import type { RequestKindConfig } from "@/lib/request-kinds/types";

type RequestDetailBackLinkProps = {
  config: RequestKindConfig;
  viewerRole: "patient" | "pharmacien";
};

export function RequestDetailBackLink({ config, viewerRole }: RequestDetailBackLinkProps) {
  const t = useTranslations("common");
  const tUnified = useTranslations("hub.unifiedHub");
  const href = hubPathForRequestKind(config.id, viewerRole);
  const label = viewerRole === "patient" ? tUnified("patientTitle") : tUnified("pharmacistTitle");
  const linkClass =
    viewerRole === "patient" ? config.theme.patientBackLinkClass : config.theme.pharmacistBackLinkClass;

  return (
    <Link href={href} className={`inline-flex items-center gap-1 text-xs font-medium underline ${linkClass}`}>
      <ChevronLeft className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
      {t("back")} — {label}
    </Link>
  );
}
