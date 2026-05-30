import type { RequestKindAccent, RequestKindId } from "@/lib/request-kinds/types";

/** Coquille neutre globale — pas de gradient ni bordure colorée pleine largeur. */
export const neutralHeaderShell =
  "mt-2 rounded-xl border border-border/80 bg-card px-3 py-3 shadow-sm sm:px-4";

export const neutralHeaderShellForStatus = (_status: string): string => neutralHeaderShell;

export const neutralCardShell =
  "rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-border hover:shadow-md";

/** Blocs dossier patient (À réserver, À commander, point d'attention, repliables). */
export const neutralBucketSectionShell =
  "space-y-2 rounded-xl border border-border/80 bg-card p-4 shadow-sm";

export type RequestKindAccentClasses = {
  pill: string;
  pillText: string;
  rail: string;
  dot: string;
  backLink: string;
};

const ACCENT_MAP: Record<RequestKindAccent, RequestKindAccentClasses> = {
  sky: {
    pill: "bg-sky-50 border border-sky-200/60",
    pillText: "text-sky-800",
    rail: "border-l-[3px] border-l-sky-400/50",
    dot: "bg-sky-500",
    backLink: "text-primary font-medium underline underline-offset-2",
  },
  amber: {
    pill: "bg-amber-50 border border-amber-200/60",
    pillText: "text-amber-900",
    rail: "border-l-[3px] border-l-amber-400/50",
    dot: "bg-amber-500",
    backLink: "text-primary font-medium underline underline-offset-2",
  },
  violet: {
    pill: "bg-violet-50 border border-violet-200/60",
    pillText: "text-violet-900",
    rail: "border-l-[3px] border-l-violet-400/50",
    dot: "bg-violet-500",
    backLink: "text-primary font-medium underline underline-offset-2",
  },
};

const KIND_LABEL: Record<RequestKindId, string> = {
  product_request: "Produits",
  prescription: "Ordonnance",
  free_consultation: "Consultation",
};

export function requestKindAccentClasses(accent: RequestKindAccent): RequestKindAccentClasses {
  return ACCENT_MAP[accent];
}

export function requestKindLabelFr(kindId: RequestKindId): string {
  return KIND_LABEL[kindId];
}

export function requestKindAccentFromId(kindId: RequestKindId): RequestKindAccent {
  if (kindId === "prescription") return "amber";
  if (kindId === "free_consultation") return "violet";
  return "sky";
}
