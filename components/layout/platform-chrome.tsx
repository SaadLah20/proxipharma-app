"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { BodyScrollLockRecovery } from "@/components/layout/body-scroll-lock-recovery";
import { PlatformBottomNav } from "@/components/layout/platform-bottom-nav";
import { PlatformHeader } from "@/components/layout/platform-header";
import { platformBottomNavPadClass } from "@/lib/platform-bottom-nav";
import { usePlatformBottomNavVisible } from "@/lib/use-platform-bottom-nav-visible";

export function PlatformChrome({ children }: { children: ReactNode }) {
  const showBottomNav = usePlatformBottomNavVisible();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BodyScrollLockRecovery />
      <PlatformHeader />
      <div
        className={clsx(
          "flex flex-col pt-[3.25rem] sm:pt-14",
          showBottomNav && platformBottomNavPadClass()
        )}
      >
        {children}
      </div>
      <PlatformBottomNav />
    </div>
  );
}
