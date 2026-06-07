"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { promoReservationUiTheme } from "@/lib/promo/promo-reservation-ui-theme";
import type { PromoReservationStatus } from "@/lib/promo/types";
import { cn } from "@/lib/utils";

const STEP_STATUSES: PromoReservationStatus[] = [
  "submitted",
  "confirmed",
  "collected",
  "unavailable",
  "cancelled",
];

export function PatientPromoReservationJourneyModal({
  open,
  currentStatus,
  onClose,
}: {
  open: boolean;
  currentStatus: PromoReservationStatus;
  onClose: () => void;
}) {
  const t = useTranslations("promo.journeyModal");
  const tCommon = useTranslations("common");
  const theme = promoReservationUiTheme;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AppModalOverlay open aria-labelledby="promo-journey-title" onBackdropClick={onClose}>
      <div
        className={cn("mx-auto w-full max-w-md rounded-2xl border bg-card shadow-2xl", theme.modalShell)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("border-b px-4 py-3", theme.modalHeader)}>
          <h2 id="promo-journey-title" className="text-sm font-bold text-foreground">
            {t("title")}
          </h2>
          <p className="mt-1 text-[11px] text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ul className="max-h-[min(60vh,20rem)] space-y-2 overflow-y-auto px-4 py-3 text-[11px]">
          {STEP_STATUSES.map((status) => {
            const active = status === currentStatus;
            const isArchive = status === "unavailable" || status === "cancelled";
            return (
              <li
                key={status}
                className={cn(
                  "rounded-lg border px-2.5 py-2",
                  active
                    ? "border-emerald-300/60 bg-emerald-50/50 ring-1 ring-emerald-200/40"
                    : "border-border/70 bg-muted/10",
                  isArchive && !active && "opacity-80",
                )}
              >
                <p className="font-bold text-foreground">{t(`steps.${status}.title`)}</p>
                <p className="mt-0.5 leading-snug text-muted-foreground">{t(`steps.${status}.body`)}</p>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border/60 px-4 py-3">
          <button
            type="button"
            className="h-9 w-full rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:bg-muted/40"
            onClick={onClose}
          >
            {tCommon("close")}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
