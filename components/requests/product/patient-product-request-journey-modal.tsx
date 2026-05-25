"use client";

import { useEffect } from "react";
import { Check, Circle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    status: "Envoyée",
    title: "Vous envoyez votre liste",
    body: "La pharmacie reçoit la demande et peut la modifier tant qu’elle n’a pas publié sa réponse.",
  },
  {
    status: "En cours de traitement",
    title: "L’officine examine le dossier",
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

export function PatientProductRequestJourneyModal({
  open,
  currentStatus,
  onClose,
}: {
  open: boolean;
  currentStatus: string;
  onClose: () => void;
}) {
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

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fermer" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-journey-title"
        className={cn(
          "relative z-10 flex max-h-[min(88dvh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
          t.modalShell
        )}
      >
        <div className={cn("flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3", t.modalHeader)}>
          <div className="flex min-w-0 items-start gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
              <Info className="size-4" aria-hidden />
            </span>
            <div>
              <h2 id="product-journey-title" className="text-base font-bold text-foreground">
                Parcours d&apos;une demande de produits
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Les grandes étapes, de l&apos;envoi à la clôture.</p>
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
        <ol className="min-h-0 flex-1 space-y-0 overflow-y-auto px-4 py-3">
          {STEPS.map((step, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            return (
              <li
                key={step.status}
                className={cn(
                  "relative flex gap-3 pb-4 last:pb-0",
                  i < STEPS.length - 1 &&
                    "before:absolute before:bottom-0 before:left-[0.9rem] before:top-8 before:w-px before:bg-sky-200/80"
                )}
              >
                <span
                  className={cn(
                    "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                    done
                      ? "border-sky-600 bg-sky-600 text-white"
                      : current
                        ? "border-sky-600 bg-sky-50 text-sky-800"
                        : "border-border/80 bg-muted/30 text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : current ? <Circle className="size-3 fill-sky-600 stroke-sky-600" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide",
                      current ? "text-sky-800" : done ? "text-sky-700/90" : "text-muted-foreground"
                    )}
                  >
                    {step.status}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{step.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className={cn("shrink-0 border-t px-4 py-3", t.searchDivider)}>
          <Button type="button" className={cn("h-10 w-full font-semibold", t.cta)} onClick={onClose}>
            Compris
          </Button>
        </div>
      </div>
    </div>
  );
}
