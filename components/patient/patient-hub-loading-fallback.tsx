"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/compact-shell";

export function PatientHubLoadingFallback({ maxWidthClass = "max-w-3xl" }: { maxWidthClass?: string }) {
  const tCommon = useTranslations("common");
  return (
    <PageShell maxWidthClass={maxWidthClass}>
      <p className="text-muted-foreground">{tCommon("loading")}</p>
    </PageShell>
  );
}
