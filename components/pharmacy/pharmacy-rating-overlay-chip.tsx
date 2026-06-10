"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { PharmacyRatingForm } from "@/components/pharmacy/pharmacy-rating-form";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { cn } from "@/lib/utils";

export function PharmacyRatingOverlayChip({
  pharmacyId,
  ratingAvg,
  ratingCount,
  onRatingUpdated,
  className,
  onPointerEventCapture,
}: {
  pharmacyId: string;
  ratingAvg: number | null;
  ratingCount: number | null;
  onRatingUpdated?: (avg: number, count: number) => void;
  className?: string;
  /** Bloque la navigation parente (carte annuaire en lien). */
  onPointerEventCapture?: (e: MouseEvent) => void;
}) {
  const t = useTranslations("pharmacyPublic");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [ratedSnapshot, setRatedSnapshot] = useState<{ avg: number; count: number } | null>(null);

  const displayAvg = ratedSnapshot?.avg ?? ratingAvg;
  const displayCount = ratedSnapshot?.count ?? ratingCount;
  const ratingCountN = displayCount ?? 0;
  const ratingLabel =
    ratingCountN > 0
      ? t("ratingOverlaySummary", {
          avg: Number(displayAvg ?? 0).toFixed(1),
          count: ratingCountN,
        })
      : t("noReviewsYet");

  const handleUpdated = (nextAvg: number, nextCount: number) => {
    setRatedSnapshot({ avg: nextAvg, count: nextCount });
    onRatingUpdated?.(nextAvg, nextCount);
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          "absolute start-2 top-2 z-[4] inline-flex max-w-[min(100%-4rem,12rem)] cursor-pointer items-center gap-0.5 whitespace-nowrap rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm transition sm:max-w-[min(100%-4.5rem,13rem)]",
          "hover:bg-black/65 hover:ring-2 hover:ring-amber-300/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
          className
        )}
        aria-label={t("ratingOverlayChipAria", { label: ratingLabel })}
        onClick={(e) => {
          onPointerEventCapture?.(e);
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onMouseDown={(e) => {
          onPointerEventCapture?.(e);
          e.stopPropagation();
        }}
      >
        <Star className="size-3 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
        <span>{ratingLabel}</span>
      </button>

      <AppModalOverlay open={open} onBackdropClick={() => setOpen(false)} aria-labelledby="pharmacy-rating-modal-title">
        <div
          className={cn(pharmacyPublicCard, "mx-auto w-full max-w-md p-4 shadow-xl")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 id="pharmacy-rating-modal-title" className="text-base font-bold text-foreground">
              {t("ratingOverlayModalTitle")}
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted/50"
              onClick={() => setOpen(false)}
            >
              {tc("close")}
            </button>
          </div>
          <PharmacyRatingForm
            pharmacyId={pharmacyId}
            ratingAvg={displayAvg}
            ratingCount={displayCount}
            embedded
            onUpdated={handleUpdated}
          />
        </div>
      </AppModalOverlay>
    </>
  );
}
