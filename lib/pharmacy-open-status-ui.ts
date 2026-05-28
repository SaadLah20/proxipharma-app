import { clsx } from "clsx";
import type { PharmacyOpenStatus } from "@/lib/pharmacy-profile-types";

/** Texte / libellé « fermé » (créneau, horaires exception) — rouge uniforme. */
export const pharmacyClosedTextClass = "font-semibold text-rose-700";

/** Badge statut sur photo (annuaire, couverture fiche publique). */
export function pharmacyOpenStatusOverlayBadgeClass(status: PharmacyOpenStatus): string {
  return clsx(
    "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 backdrop-blur-sm",
    status === "open"
      ? "bg-emerald-500/90 text-white ring-emerald-600/40"
      : "bg-rose-600/90 text-white ring-rose-700/45"
  );
}

/** Badge statut sur fond clair (ex. encart « Aujourd'hui »). */
export function pharmacyOpenStatusInlineBadgeClass(status: PharmacyOpenStatus): string {
  return clsx(
    "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
    status === "open"
      ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80"
      : "bg-rose-50 text-rose-900 ring-1 ring-rose-200/80"
  );
}

/** Ligne d'horaire publique contenant fermé / férié. */
export function pharmacyScheduleLineBadgeClass(line: string): string {
  const closed = /fermé|férié/i.test(line);
  const oncall = /garde/i.test(line);
  const open = /matin|après-midi|\d{1,2}h\d/i.test(line);
  return clsx(
    "inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium leading-snug",
    closed && "bg-rose-50 text-rose-900 ring-1 ring-rose-200/80",
    oncall && "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80",
    !closed && !oncall && open && "bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-200/70",
    !closed && !oncall && !open && "bg-muted/50 text-foreground/85 ring-1 ring-border/60"
  );
}

/** Case « Fermé » (édition horaires pharmacien). */
export function pharmacyClosedCheckboxLabelClass(checked: boolean): string {
  return clsx("flex items-center gap-1 text-[10px] font-semibold", checked ? pharmacyClosedTextClass : "text-foreground");
}

/** Bloc créneau horaire quand la période est fermée. */
export function pharmacyClosedTimeRangeShellClass(closed: boolean): string | undefined {
  return closed ? "border-rose-200/80 bg-rose-50/35" : undefined;
}
