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

export function uiActionBtnFlexPrimary(className?: string) {
  return uiBtn("default", "lg", cn("h-10 min-w-0 flex-1", className));
}

export function uiActionBtnFlexOutline(className?: string) {
  return uiBtn("outline", "lg", cn("h-10 min-w-0 flex-1", className));
}

/** Pied de modale (Retour / Confirmer). */
export function uiActionBtnModalOutline(className?: string) {
  return uiBtn("outline", "default", cn("w-full sm:order-1 sm:w-auto", className));
}

export function uiActionBtnModalPrimary(className?: string) {
  return uiBtn("default", "default", cn("w-full sm:order-2 sm:w-auto sm:min-w-[180px]", className));
}

export function uiActionBtnModalFlexOutline(className?: string) {
  return uiBtn("outline", "lg", cn("h-10 flex-1", className));
}

export function uiActionBtnModalFlexPrimary(className?: string) {
  return uiBtn("default", "lg", cn("h-10 flex-1", className));
}

/** Filtres hub liste (Ouvrir / Réduire). */
export function uiActionBtnFilterToggle(className?: string) {
  return uiBtn("outline", "sm", className);
}

export function uiActionBtnCompactOutline(className?: string) {
  return uiBtn("outline", "sm", cn("h-8 px-2.5 text-[11px]", className));
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
