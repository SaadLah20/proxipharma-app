import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium leading-snug",
  {
    variants: {
      variant: {
        default: "border-border/80 bg-muted text-foreground",
        neutral: "border-border/80 bg-card text-foreground",
        attention: "border-amber-200/80 bg-amber-50 text-amber-950",
        success: "border-emerald-200/80 bg-emerald-50 text-emerald-950",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Alias sémantique pour statuts dossier. */
export function StatusPill({
  className,
  variant = "neutral",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <Badge className={className} variant={variant} {...props} />;
}

export { badgeVariants };
