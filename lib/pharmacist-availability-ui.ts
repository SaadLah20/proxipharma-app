import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Package, ShoppingCart, XCircle } from "lucide-react";
import { availabilityStatusFr } from "@/lib/request-display";

export type AvailabilityUi = {
  label: string;
  /** Classes pour badge pill (fond + texte + ring) */
  badgeClass: string;
  /** Bordure gauche carte */
  accentClass: string;
  Icon: LucideIcon;
};

const FALLBACK: AvailabilityUi = {
  label: "—",
  badgeClass: "bg-slate-100 text-slate-800 ring-1 ring-slate-200/90",
  accentClass: "border-l-slate-400",
  Icon: Package,
};

export function availabilityStatusUi(status: string | null | undefined): AvailabilityUi {
  if (!status) return FALLBACK;
  const label = availabilityStatusFr[status] ?? status;
  switch (status) {
    case "available":
      return {
        label,
        badgeClass: "bg-emerald-200/90 text-emerald-950 ring-1 ring-emerald-400/75",
        accentClass: "border-l-emerald-600",
        Icon: CheckCircle2,
      };
    case "partially_available":
      return {
        label,
        badgeClass: "bg-cyan-200/90 text-cyan-950 ring-1 ring-cyan-400/75",
        accentClass: "border-l-cyan-600",
        Icon: Package,
      };
    case "unavailable":
      return {
        label,
        badgeClass: "bg-slate-300/90 text-slate-950 ring-1 ring-slate-400/80",
        accentClass: "border-l-slate-600",
        Icon: XCircle,
      };
    case "to_order":
      return {
        label,
        badgeClass: "bg-amber-200/90 text-amber-950 ring-1 ring-amber-400/80",
        accentClass: "border-l-amber-600",
        Icon: ShoppingCart,
      };
    case "market_shortage":
      return {
        label,
        badgeClass: "bg-rose-200/90 text-rose-950 ring-1 ring-rose-400/75",
        accentClass: "border-l-rose-600",
        Icon: AlertTriangle,
      };
    default:
      return {
        ...FALLBACK,
        label,
      };
  }
}

/** Bouton dispo compact (ligne basse carte pharmacien — demande envoyée). */
export function availabilitySentLineButtonClass(status: string | null | undefined): string {
  const base = "border bg-card text-[10px] font-medium text-foreground";
  switch (status) {
    case "available":
      return `${base} border-emerald-300/85 bg-emerald-100/70 text-emerald-950`;
    case "partially_available":
      return `${base} border-cyan-300/85 bg-cyan-100/70 text-cyan-950`;
    case "unavailable":
      return `${base} border-slate-300/80 bg-slate-200/55 text-slate-900`;
    case "to_order":
      return `${base} border-amber-300/85 bg-amber-100/70 text-amber-950`;
    case "market_shortage":
      return `${base} border-rose-300/80 bg-rose-100/65 text-rose-950`;
    default:
      return `${base} border-border/80 bg-muted/20`;
  }
}
