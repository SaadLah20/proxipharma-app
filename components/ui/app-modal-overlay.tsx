"use client";

import { clsx } from "clsx";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lockBodyScroll } from "@/lib/ui-body-scroll-lock";
import { Z_MODAL_OVERLAY } from "@/lib/ui-z-index";

const noOpSubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(noOpSubscribe, () => true, () => false);
}

type Props = {
  open: boolean;
  children: ReactNode;
  className?: string;
  /** Clic sur le fond assombri (pas sur le panneau). */
  onBackdropClick?: () => void;
  role?: "dialog" | "presentation";
  "aria-modal"?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Overlay plein écran porté sur `document.body` — au-dessus des footers sticky (`z-40`).
 */
export function AppModalOverlay({
  open,
  children,
  className,
  onBackdropClick,
  role = "dialog",
  "aria-modal": ariaModal = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}: Props) {
  const clientMounted = useClientMounted();

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open || !clientMounted) return null;

  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 flex items-end justify-center bg-black/50 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-[1px] sm:items-center sm:p-4 sm:pb-4",
        Z_MODAL_OVERLAY,
        className
      )}
      role={role}
      aria-modal={ariaModal}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBackdropClick?.();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
