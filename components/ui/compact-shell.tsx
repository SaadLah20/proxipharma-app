import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Conteneur page dashboard : lisible sur desktop, dense sur mobile. */
export function PageShell({
  children,
  className,
  maxWidthClass = "max-w-3xl",
}: {
  children: ReactNode;
  className?: string;
  /** ex. `max-w-4xl` pour écran pharmacien plus large */
  maxWidthClass?: string;
}) {
  return (
    <main
      className={clsx(
        "mx-auto min-h-screen px-3 pb-12 pt-3 sm:px-4 sm:pb-14 sm:pt-4",
        maxWidthClass,
        className
      )}
    >
      {children}
    </main>
  );
}

export function CompactCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "overflow-hidden rounded-lg border border-border/90 bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {children}
    </section>
  );
}

export function CompactCardHeader({
  title,
  right,
  className,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-2.5 py-1.5 sm:px-3",
        className
      )}
    >
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function CompactCardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("p-2.5 text-xs leading-snug sm:p-3 sm:text-[13px]", className)}>{children}</div>;
}

/** Ligne horizontale label — valeur (pleine largeur). */
export function KvRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border/40 py-1 last:border-0">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[11px] font-medium text-foreground sm:text-xs">{children}</span>
    </div>
  );
}
