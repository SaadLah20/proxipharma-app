import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BtnVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
type BtnSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

function uiBtn(variant: BtnVariant, size: BtnSize, className?: string) {
  return cn(buttonVariants({ variant, size }), className);
}

/** CTA pleine largeur (footer sticky). */
export function uiActionBtnFull(className?: string) {
  return uiBtn("default", "lg", cn("h-10 w-full", className));
}

export function uiActionBtnFullOutline(className?: string) {
  return uiBtn("outline", "lg", cn("h-10 w-full gap-2", className));
}

export function uiActionBtnFullSecondary(className?: string) {
  return uiBtn("outline", "lg", cn("mx-auto min-h-[2.75rem] w-full max-w-md gap-2", className));
}

export function uiActionBtnDestructiveWide(className?: string) {
  return uiBtn("destructive", "lg", cn("mx-auto min-h-[2.75rem] w-full max-w-md", className));
}

export function uiActionBtnFullDestructive(className?: string) {
  return uiBtn("destructive", "lg", cn("h-10 w-full", className));
}

/** Sous-titre long (ex. « Enregistrer les modifications ») — autorise le retour à la ligne. */
const UI_ACTION_BTN_FLEX =
  "h-auto min-h-10 min-w-0 flex-1 shrink whitespace-normal px-2 py-2 text-center text-[11px] leading-snug sm:px-2.5 sm:text-xs";

/** Paire Annuler (gauche) + action principale (droite) dans un footer étroit. */
export function uiActionBtnFlexRow(className?: string) {
  return cn("flex flex-row items-stretch gap-2", className);
}

/** Bouton court à gauche (ex. « Annuler »). */
export function uiActionBtnFlexCancel(className?: string) {
  return uiBtn(
    "outline",
    "lg",
    cn(
      "h-10 min-h-10 w-auto shrink-0 flex-none whitespace-nowrap px-3 text-xs sm:px-3.5 sm:text-sm",
      className
    )
  );
}

export function uiActionBtnFlexPrimary(className?: string) {
  return uiBtn("default", "lg", cn(UI_ACTION_BTN_FLEX, className));
}

export function uiActionBtnFlexOutline(className?: string) {
  return uiBtn("outline", "lg", cn(UI_ACTION_BTN_FLEX, className));
}

/** Pied de modale (Retour / Confirmer). */
export function uiActionBtnModalOutline(className?: string) {
  return uiBtn("outline", "default", cn("w-full sm:order-1 sm:w-auto", className));
}

export function uiActionBtnModalPrimary(className?: string) {
  return uiBtn("default", "default", cn("w-full sm:order-2 sm:w-auto sm:min-w-[180px]", className));
}

export function uiActionBtnModalFlexOutline(className?: string) {
  return uiBtn("outline", "lg", cn(UI_ACTION_BTN_FLEX, className));
}

export function uiActionBtnModalFlexPrimary(className?: string) {
  return uiBtn("default", "lg", cn(UI_ACTION_BTN_FLEX, className));
}

/** Filtres hub liste (Ouvrir / Réduire). */
export function uiActionBtnFilterToggle(className?: string) {
  return uiBtn("outline", "sm", className);
}

/** Boutons compacts alignés (bandeau officine dossier patient, etc.). */
export function uiActionBtnCompactOutline(className?: string) {
  return uiBtn(
    "outline",
    "sm",
    cn("inline-flex h-8 min-h-8 items-center justify-center px-2.5 text-[11px] font-semibold", className)
  );
}

export function uiActionBtnCompactPrimary(className?: string) {
  return uiBtn(
    "default",
    "sm",
    cn("inline-flex h-8 min-h-8 items-center justify-center px-2.5 text-[11px] font-semibold shadow-sm", className)
  );
}

export function uiActionBtnSmOutline(className?: string) {
  return uiBtn("outline", "sm", cn("px-3 py-2 text-xs", className));
}

export function uiActionBtnSmPrimary(className?: string) {
  return uiBtn("default", "sm", cn("px-3 py-2 text-xs", className));
}

export function uiActionBtnSmDestructive(className?: string) {
  return uiBtn("destructive", "sm", cn("px-3 py-2 text-xs", className));
}

export function uiActionBtnModalDismiss(className?: string) {
  return uiBtn("outline", "lg", cn("h-9 w-full", className));
}

/** Actions rapides carte annuaire (Appeler, WhatsApp, Itinéraire). */
export function uiAnnuaireQuickAction(className?: string) {
  return uiBtn(
    "outline",
    "sm",
    cn(
      "h-auto flex-col gap-0.5 rounded-lg py-2 text-[10px] font-bold shadow-sm",
      className
    )
  );
}

export function uiAnnuairePaginationBtn(className?: string) {
  return uiBtn("outline", "sm", cn("gap-1 px-2.5 py-1.5", className));
}

/** Actions sur la photo (annuaire) — icône seule, fond clair pour lisibilité. */
export function uiAnnuaireActionOverlayBtn(className?: string) {
  return cn(
    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/92 text-foreground shadow-md ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-white",
    className
  );
}

/** Icône sur la photo — disque circulaire semi-opaque (lisible sur fond clair ou foncé). */
export function uiAnnuaireActionOverlayBtnGhost(className?: string) {
  return cn(
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-black/50 text-white shadow-md ring-1 ring-white/30 backdrop-blur-md transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
    className
  );
}
