"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  STICKY_FOOTER_SAFE_BOTTOM,
  stickyFooterToneBorderClass,
  type StickyFooterTone,
} from "@/lib/platform-sticky-footer";

const SHELL =
  "fixed inset-x-0 bottom-0 border-t bg-background/95 shadow-[0_-4px_18px_rgba(15,23,42,0.07)] backdrop-blur-md supports-[backdrop-filter]:bg-background/90";

type FooterProps = {
  children: ReactNode;
  tone?: StickyFooterTone;
  /** largeur contenu intérieur */
  width?: "lg" | "3xl";
  zIndex?: number;
  className?: string;
  innerClassName?: string;
};

export function PlatformStickyFooter({
  children,
  tone = "neutral",
  width = "lg",
  zIndex = 10030,
  className,
  innerClassName,
}: FooterProps) {
  return (
    <div
      className={clsx(SHELL, stickyFooterToneBorderClass(tone), STICKY_FOOTER_SAFE_BOTTOM, className)}
      style={{ zIndex }}
    >
      <div
        className={clsx(
          width === "3xl" ? "mx-auto max-w-3xl px-3 sm:px-4" : "mx-auto max-w-lg px-4 sm:px-5",
          "py-2",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Plusieurs bandeaux empilés (pharmacien : action + stats + enregistrer). */
export function PlatformStickyFooterStack({
  children,
  tone = "sky",
  zIndex = 10050,
  className,
}: Omit<FooterProps, "innerClassName" | "width">) {
  return (
    <div
      className={clsx(
        SHELL,
        "flex flex-col",
        stickyFooterToneBorderClass(tone),
        STICKY_FOOTER_SAFE_BOTTOM,
        className
      )}
      style={{ zIndex }}
    >
      {children}
    </div>
  );
}

export function PlatformStickyFooterStackRow({
  children,
  width = "3xl",
  bordered = true,
  compact = false,
}: {
  children: ReactNode;
  width?: "lg" | "3xl";
  bordered?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        bordered && "border-b border-inherit last:border-b-0",
        compact ? "px-3 py-1.5 sm:px-4" : "px-3 py-2 sm:px-4"
      )}
    >
      <div className={clsx(width === "3xl" ? "mx-auto max-w-3xl" : "mx-auto max-w-lg")}>{children}</div>
    </div>
  );
}

export function PlatformStickyFooterSummaryRow({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="flex min-h-8 flex-nowrap items-center justify-between gap-3">
      <p className="min-w-0 shrink text-sm font-medium leading-tight text-muted-foreground">{left}</p>
      <p className="shrink-0 text-base font-bold tabular-nums leading-none text-foreground sm:text-lg">
        {right}
      </p>
    </div>
  );
}
