import { cn } from "@/lib/utils";

/** Hauteur minimale commune des onglets variante (principal / alternatives). */
export const VARIANT_TAB_MIN_H = "min-h-[1.85rem]";

const variantTabBaseShell =
  "flex min-w-0 items-center rounded-lg border bg-muted/20 transition";

const variantTabViewingShell = "border-foreground/20 bg-card shadow-sm ring-1 ring-foreground/5";

const variantTabSelectedShell = "border-emerald-500/70 bg-emerald-50/40 ring-1 ring-emerald-500/20";

const variantTabNotRetainableShell = "border-dashed border-border/60 opacity-90";

/** Coque d’un onglet variante (consulté / retenu / non retenable). */
export function variantTabShellClass(opts: {
  retainable: boolean;
  isViewing: boolean;
  isSelected?: boolean;
}): string {
  const { retainable, isViewing, isSelected } = opts;

  return cn(
    variantTabBaseShell,
    VARIANT_TAB_MIN_H,
    !retainable && variantTabNotRetainableShell,
    retainable && !isSelected && !isViewing && "border-border/80 hover:border-border hover:bg-card",
    retainable && isSelected && !isViewing && variantTabSelectedShell,
    retainable && isSelected && isViewing && cn(variantTabViewingShell, "border-emerald-500/70 ring-emerald-500/15"),
    retainable && !isSelected && isViewing && cn("border-border/80", variantTabViewingShell)
  );
}

/** Case à cocher variante (vide). */
export function variantTabCheckboxBoxClass(isSelected?: boolean): string {
  return cn(
    "size-3.5 shrink-0 rounded border bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
    isSelected ? "border-emerald-500/70" : "border-border/80"
  );
}

export const VARIANT_TAB_CHECKBOX_PAD = "flex shrink-0 items-center py-1 ps-2 pe-1";

/** Barre « retenir » compacte (patient). */
export function variantRetainBarShellClass(isSelected: boolean): string {
  return cn(
    "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 transition",
    isSelected
      ? "border-emerald-500/80 bg-emerald-50/90 shadow-sm ring-1 ring-emerald-500/25"
      : "border-emerald-500/35 bg-emerald-50/40 hover:border-emerald-500/55 hover:bg-emerald-50/70"
  );
}

export function variantRetainBarLabelClass(isSelected: boolean): string {
  return cn(
    "text-[11px] font-bold leading-snug sm:text-[12px]",
    isSelected ? "text-emerald-900" : "text-foreground"
  );
}
