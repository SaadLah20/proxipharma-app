"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { ProductRequestLineMessageIconButton } from "@/components/pharmacy/patient-demande-produits-ui";
import { lineConversationVisual } from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { patientWorkflowLineAccent } from "@/lib/patient-product-request-line-ui";
import { requestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { uiActionBtnModalDismiss } from "@/lib/ui-action-buttons";
import { cn } from "@/lib/utils";

/** Bouton notes ligne (lecture seule), même gabarit que Historique sur carte validée. */
export function PatientLineNotesIconButton({
  productName,
  client,
  pharmacist,
  requestType = "product_request",
}: {
  productName: string;
  client: string;
  pharmacist: string;
  requestType?: string;
}) {
  const tCommon = useTranslations("common");
  const tConversation = useTranslations("conversation");
  const tDemandes = useTranslations("demandes");
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const kindTheme = requestKindUiTheme(requestType);
  const patientNoteBorderClass =
    requestType === "prescription"
      ? "border-l-amber-500/70"
      : requestType === "free_consultation"
        ? "border-l-violet-500/70"
        : "border-l-sky-500/70";
  const c = client.trim();
  const p = pharmacist.trim();
  const visual = lineConversationVisual(c, p);
  const lineAccent = patientWorkflowLineAccent(requestType) ?? "sky";

  return (
    <>
      <ProductRequestLineMessageIconButton
        visual={visual}
        onClick={() => setOpen(true)}
        lineAccent={lineAccent}
      />
      <AppModalOverlay open={open} aria-labelledby={titleId} onBackdropClick={() => setOpen(false)}>
        <div
          className={cn(
            "max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto",
            kindTheme.modalShell
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={cn("flex items-start justify-between gap-2 border-b px-3 py-2", kindTheme.modalHeader)}>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="block">{tDemandes("responded.messageTitle")}</span>
                <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">
                  {productName}
                </span>
              </h2>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
              aria-label={tCommon("closeAria")}
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="max-h-[min(60vh,16rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
            {c ? (
              <div className={cn("rounded-lg border border-border/80 border-l-2 bg-muted/20 px-2.5 py-2", patientNoteBorderClass)}>
                <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{tConversation("you")}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-foreground">{c}</p>
              </div>
            ) : null}
            {p ? (
              <div className="rounded-lg border border-border/80 border-l-2 border-l-emerald-500/70 bg-muted/20 px-2.5 py-2">
                <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">{tConversation("pharmacy")}</p>
                <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-foreground">{p}</p>
              </div>
            ) : null}
            {!c && !p ? (
              <p className="text-[11px] text-muted-foreground">{tDemandes("responded.noMessageOnProduct")}</p>
            ) : null}
          </div>
          <div className="border-t border-border/60 px-3 py-2">
            <button type="button" className={uiActionBtnModalDismiss()} onClick={() => setOpen(false)}>
              {tCommon("close")}
            </button>
          </div>
        </div>
      </AppModalOverlay>
    </>
  );
}
