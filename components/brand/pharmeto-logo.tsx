import Image from "next/image";
import { cn } from "@/lib/utils";

type PharmetoLogoVariant = "icon" | "lockup" | "wordmark";

const ICON_SRC = "/brand/pharmeto-icon.svg";
const LOCKUP_SRC = "/brand/pharmeto-lockup.svg";

type PharmetoLogoProps = {
  variant?: PharmetoLogoVariant;
  className?: string;
  /** Hauteur cible (largeur auto pour lockup). */
  height?: number;
  priority?: boolean;
  /** Icône seulement décorative quand le wordmark est affiché à côté. */
  decorative?: boolean;
};

export function PharmetoLogo({
  variant = "lockup",
  className,
  height = 36,
  priority = false,
  decorative = false,
}: PharmetoLogoProps) {
  if (variant === "wordmark") {
    return (
      <span
        className={cn("font-bold tracking-tight text-foreground", className)}
        style={{ fontSize: Math.round(height * 0.5) }}
      >
        Pharmeto
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <Image
        src={ICON_SRC}
        alt={decorative ? "" : "Pharmeto"}
        aria-hidden={decorative ? true : undefined}
        width={height}
        height={height}
        unoptimized
        className={cn("shrink-0", className)}
        priority={priority}
      />
    );
  }

  const width = Math.round(height * (320 / 44));
  return (
    <Image
      src={LOCKUP_SRC}
      alt="Pharmeto"
      width={width}
      height={height}
      unoptimized
      className={cn("shrink-0", className)}
      priority={priority}
    />
  );
}
