"use client";

import { useTranslations } from "next-intl";
import type { RequestStaleState } from "@/lib/request-detail-stale";
import { requestDetailStaleMessage, requestDetailStaleTitle } from "@/lib/i18n/request-detail-stale-copy";
import { uiActionBtnFilterToggle } from "@/lib/ui-action-buttons";

export function RequestDetailStaleBanner({
  stale,
  onRefresh,
  className,
}: {
  stale: RequestStaleState;
  onRefresh: () => void | Promise<void>;
  className?: string;
}) {
  const t = useTranslations("demandes.drift");

  return (
    <div
      className={
        className ??
        "rounded-lg border border-amber-300/80 bg-amber-50/90 p-3 text-[11px] text-amber-950 shadow-sm"
      }
    >
      <p className="font-bold">{requestDetailStaleTitle(t, stale)}</p>
      <p className="mt-1 leading-snug">{requestDetailStaleMessage(t, stale)}</p>
      <button type="button" className={uiActionBtnFilterToggle("mt-2")} onClick={() => void onRefresh()}>
        {t("refreshButton")}
      </button>
    </div>
  );
}
