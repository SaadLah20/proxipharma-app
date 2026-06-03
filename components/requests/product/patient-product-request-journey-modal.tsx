"use client";

import { useEffect, useMemo } from "react";
import { Check, Circle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { productRequestPublicTheme as productTheme } from "@/lib/request-kinds/product-request-public-theme";
import { requestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { cn } from "@/lib/utils";

const PRODUCT_STEPS = [
  {
    status: "Envoyée",
    title: "Vous envoyez votre liste",
    body: "La pharmacie reçoit la demande et peut la modifier tant qu'elle n'a pas publié sa réponse.",
  },
  {
    status: "En cours de traitement",
    title: "L'officine examine le dossier",
    body: "Disponibilité, prix indicatifs et éventuelles alternatives sont renseignés produit par produit.",
  },
  {
    status: "Répondue — à valider",
    title: "Vous validez votre choix",
    body: "Pour chaque ligne : garder ou non, quantité, alternative éventuelle, puis date de passage et validation.",
  },
  {
    status: "Validée",
    title: "Préparation en officine",
    body: "Réservation ou commande fournisseur selon les produits retenus ; suivi visible sur chaque carte.",
  },
  {
    status: "Traitée",
    title: "Passage au comptoir",
    body: "Retrait des produits prêts ; la pharmacie peut clôturer le dossier après les retraits.",
  },
  {
    status: "Clôturée",
    title: "Dossier terminé",
    body: "Tout a été récupéré ou le dossier est clos (annulation, expiration, etc.).",
  },
] as const;

const PRESCRIPTION_STEPS = [
  {
    status: "Envoyée",
    title: "Vous transmettez l'ordonnance",
    body: "Scan (et message éventuel) envoyés à l'officine — aucun produit à saisir de votre côté.",
  },
  {
    status: "En cours de traitement",
    title: "Saisie par la pharmacie",
    body: "L'officine lit votre ordonnance et saisit les produits (qté prescrite, disponibilité, alternatives).",
  },
  {
    status: "Répondue — à valider",
    title: "Vous validez les produits proposés",
    body: "Pour chaque ligne : garder ou non, quantité, alternative éventuelle, puis date de passage et validation.",
  },
  {
    status: "Validée",
    title: "Préparation en officine",
    body: "Réservation ou commande selon les produits retenus ; suivi visible sur chaque carte.",
  },
  {
    status: "Traitée",
    title: "Passage au comptoir",
    body: "Retrait des produits prêts ; la pharmacie peut clôturer le dossier après les retraits.",
  },
  {
    status: "Clôturée",
    title: "Ordonnance close",
    body: "Tout a été récupéré ou le dossier est clos (annulation, expiration, etc.).",
  },
] as const;

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
  const isPrescription = requestType === "prescription";
  const steps = useMemo(
    () => (isPrescription ? PRESCRIPTION_STEPS : PRODUCT_STEPS),
    [isPrescription]
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
                    currentStatus
                  )
                ? 5
                : 0;

  const title = isPrescription ? "Parcours d'une ordonnance" : "Parcours d'une demande de produits";

  return (
    <AppModalOverlay open aria-labelledby="product-journey-title" onBackdropClick={onClose}>
      <div
        className={cn(
          "flex max-h-[min(88dvh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto",
          isPrescription ? ui.modalShell : productTheme.modalShell
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3",
            isPrescription ? "border-amber-200/80 bg-amber-50/30" : productTheme.modalHeader
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
                {isPrescription
                  ? "Du scan à la clôture, comme une demande produits."
                  : "Les grandes étapes, de l'envoi à la clôture."}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        {statusDetail?.trim() ? (
          <div className={cn("shrink-0 border-b px-4 py-3", accentDetail)}>
            <p className={cn("text-[10px] font-bold uppercase tracking-wide", accentDetailLabel)}>
              À propos de ce dossier
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
                key={step.status}
                className={cn(
                  "relative flex gap-3 pb-4 last:pb-0",
                  i < steps.length - 1 &&
                    cn("before:absolute before:bottom-0 before:left-[0.9rem] before:top-8 before:w-px", timelineLine)
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full ring-2 ring-background",
                    done ? doneBg : current ? cn(currentBg, currentRing) : "bg-muted text-muted-foreground"
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
            Fermer
          </Button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
