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
        badgeClass: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300/70",
        accentClass: "border-l-emerald-500",
        Icon: CheckCircle2,
      };
    case "partially_available":
      return {
        label,
        badgeClass: "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-300/70",
        accentClass: "border-l-cyan-500",
        Icon: Package,
      };
    case "unavailable":
      return {
        label,
        badgeClass: "bg-slate-200 text-slate-900 ring-1 ring-slate-300/80",
        accentClass: "border-l-slate-500",
        Icon: XCircle,
      };
    case "to_order":
      return {
        label,
        badgeClass: "bg-amber-100 text-amber-950 ring-1 ring-amber-300/80",
        accentClass: "border-l-amber-500",
        Icon: ShoppingCart,
      };
    case "market_shortage":
      return {
        label,
        badgeClass: "bg-rose-100 text-rose-950 ring-1 ring-rose-300/70",
        accentClass: "border-l-rose-500",
        Icon: AlertTriangle,
      };
    default:
      return {
        ...FALLBACK,
        label,
      };
  }
}
