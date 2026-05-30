import type { RequestKindAccent, RequestKindId } from "@/lib/request-kinds/types";
import {
  requestKindAccentClasses,
  requestKindLabelFr,
  requestKindAccentFromId,
} from "@/lib/design-system/request-kind-accent";
import { cn } from "@/lib/utils";

export function RequestKindIndicator({
  kindId,
  accent,
  label,
  showDot = true,
  className,
}: {
  kindId?: RequestKindId;
  accent?: RequestKindAccent;
  label?: string;
  showDot?: boolean;
  className?: string;
}) {
  const resolvedAccent = accent ?? (kindId ? requestKindAccentFromId(kindId) : "sky");
  const classes = requestKindAccentClasses(resolvedAccent);
  const text = label ?? (kindId ? requestKindLabelFr(kindId) : "Demande");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        classes.pill,
        classes.pillText,
        className
      )}
    >
      {showDot ? <span className={cn("size-1.5 shrink-0 rounded-full", classes.dot)} aria-hidden /> : null}
      {text}
    </span>
  );
}

/** Filet gauche discret pour bandeaux dossier. */
export function RequestKindRail({
  accent,
  kindId,
  className,
  children,
}: {
  accent?: RequestKindAccent;
  kindId?: RequestKindId;
  className?: string;
  children: React.ReactNode;
}) {
  const resolvedAccent = accent ?? (kindId ? requestKindAccentFromId(kindId) : "sky");
  const classes = requestKindAccentClasses(resolvedAccent);
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card pl-3 shadow-sm", classes.rail, className)}>
      {children}
    </div>
  );
}
