import { cn } from "@/lib/utils";

/** Hauteur minimale commune des onglets variante (principal / alternatives). */
export const VARIANT_TAB_MIN_H = "min-h-[1.85rem]";

const variantTabBaseShell =
  "flex min-w-0 items-center rounded-lg border bg-muted/20 transition";

const variantTabViewingShell = "border-foreground/20 bg-card shadow-sm ring-1 ring-foreground/5";

const variantTabNotRetainableShell = "border-dashed border-border/60";

/** Coque d’un onglet variante — **consulté** seulement (retenu = case à cocher). */
export function variantTabShellClass(opts: {
  retainable: boolean;
  isViewing: boolean;
}): string {
  const { retainable, isViewing } = opts;

  return cn(
    variantTabBaseShell,
    VARIANT_TAB_MIN_H,
    isViewing && variantTabViewingShell,
    isViewing && !retainable && variantTabNotRetainableShell,
    !isViewing && retainable && "border-border/80 hover:border-border hover:bg-card",
    !isViewing && !retainable && cn(variantTabNotRetainableShell, "opacity-90")
  );
}

/** Case à cocher variante (vide). */
export function variantTabCheckboxBoxClass(isRetained?: boolean): string {
  return cn(
    "size-3.5 shrink-0 rounded border bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
    isRetained ? "border-emerald-500/70" : "border-border/80"
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

/** Largeur relative : onglet consulté un peu plus large (libellé complet lisible). */
export function variantTabFlexClass(isViewing: boolean, crowded: boolean): string {
  if (!crowded) {
    return isViewing ? "min-w-[4rem] flex-[1.2]" : "min-w-0 flex-1";
  }
  return isViewing ? "min-w-[5.5rem] flex-[1.55]" : "min-w-0 flex-[0.82]";
}
