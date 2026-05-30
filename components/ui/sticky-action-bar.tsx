import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function StickyActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryBusy,
  secondaryLabel,
  onSecondary,
  hint,
  className,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-[10050] border-t border-border/80 bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none",
        className
      )}
    >
      {hint ? <p className="mb-2 text-center text-xs text-muted-foreground sm:mb-3 sm:text-left">{hint}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          size="lg"
          className="h-11 w-full sm:min-w-[200px] sm:w-auto"
          disabled={primaryDisabled || primaryBusy}
          onClick={onPrimary}
        >
          {primaryBusy ? "Patientez…" : primaryLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button type="button" variant="ghost" className="h-11 w-full sm:w-auto" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
