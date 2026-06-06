"use client";

import { useEffect, useMemo } from "react";
import { Check, Circle, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { productRequestPublicTheme as productTheme } from "@/lib/request-kinds/product-request-public-theme";
import { requestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { cn } from "@/lib/utils";

const STEP_KEYS = ["s0", "s1", "s2", "s3", "s4", "s5"] as const;

export function PatientProductRequestJourneyModal({
  open,
  currentStatus,
  statusDetail,
  requestType = "product_request",
  onClose,
}: {
  open: boolean;
  currentStatus: string;
  statusDetail?: string | null;
  requestType?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("demandes.journeyModal");
  const tCommon = useTranslations("common");
  const isPrescription = requestType === "prescription";
  const steps = useMemo(
    () =>
      STEP_KEYS.map((key) => ({
        status: t(`${isPrescription ? "prescriptionSteps" : "productSteps"}.${key}.status`),
        title: t(`${isPrescription ? "prescriptionSteps" : "productSteps"}.${key}.title`),
        body: t(`${isPrescription ? "prescriptionSteps" : "productSteps"}.${key}.body`),
      })),
    [isPrescription, t],
  );
  const ui = requestKindUiTheme(requestType);
  const accentIcon = isPrescription ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";
  const accentDetail = isPrescription ? "bg-amber-50/60 text-amber-950/90" : "bg-sky-50/60 text-sky-950/90";
  const accentDetailLabel = isPrescription ? "text-amber-800" : "text-sky-800";
  const timelineLine = isPrescription ? "before:bg-amber-200/80" : "before:bg-sky-200/80";
  const currentRing = isPrescription ? "ring-amber-400/50" : "ring-sky-400/50";
  const currentBg = isPrescription ? "bg-amber-600" : "bg-sky-600";
  const doneBg = isPrescription ? "bg-amber-500/90" : "bg-sky-500/90";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeIndex =
    currentStatus === "submitted"
      ? 0
      : currentStatus === "in_review"
        ? 1
        : currentStatus === "responded"
          ? 2
          : currentStatus === "confirmed"
            ? 3
            : currentStatus === "treated"
              ? 4
              : ["completed", "partially_collected", "fully_collected", "cancelled", "abandoned", "expired"].includes(
                    currentStatus,
                  )
                ? 5
                : 0;

  const title = isPrescription ? t("titlePrescription") : t("titleProduct");

  return (
    <AppModalOverlay open aria-labelledby="product-journey-title" onBackdropClick={onClose}>
      <div
        className={cn(
          "flex max-h-[min(88dvh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto",
          isPrescription ? ui.modalShell : productTheme.modalShell,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3",
            isPrescription ? "border-amber-200/80 bg-amber-50/30" : productTheme.modalHeader,
          )}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", accentIcon)}>
              <Info className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="product-journey-title" className="text-base font-bold text-foreground">
                {title}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isPrescription ? t("subtitlePrescription") : t("subtitleProduct")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50"
            aria-label={tCommon("closeAria")}
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        {statusDetail?.trim() ? (
          <div className={cn("shrink-0 border-b px-4 py-3", accentDetail)}>
            <p className={cn("text-[10px] font-bold uppercase tracking-wide", accentDetailLabel)}>
              {t("aboutDossier")}
            </p>
            <p className="mt-1 text-xs leading-relaxed">{statusDetail.trim()}</p>
          </div>
        ) : null}
        <ol className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-3">
          {steps.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            return (
              <li
                key={step.status + i}
                className={cn(
                  "relative flex gap-3 pb-4 last:pb-0",
                  i < steps.length - 1 &&
                    cn("before:absolute before:bottom-0 before:left-[0.9rem] before:top-8 before:w-px", timelineLine),
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full ring-2 ring-background",
                    done ? doneBg : current ? cn(currentBg, currentRing) : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {done ? (
                    <Check className="size-3.5 text-white" strokeWidth={3} />
                  ) : (
                    <Circle className={cn("size-2", current ? "fill-white text-white" : "fill-current")} />
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{step.status}</p>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="shrink-0 border-t px-4 py-3">
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
