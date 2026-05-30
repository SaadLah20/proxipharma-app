import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ListRow({
  title,
  meta,
  trailing,
  href,
  onClick,
  className,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-foreground">{title}</p>
        {meta ? <div className="mt-0.5 text-sm text-muted-foreground">{meta}</div> : null}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
        {trailing}
        {href || onClick ? <ChevronRight className="size-5" aria-hidden /> : null}
      </div>
    </>
  );

  const shell = cn(
    "flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 text-left shadow-sm transition hover:border-border hover:shadow-md",
    className
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {inner}
      </button>
    );
  }
  return <div className={shell}>{inner}</div>;
}
