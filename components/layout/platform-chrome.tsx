"use client";

import type { ReactNode } from "react";
import { BodyScrollLockRecovery } from "@/components/layout/body-scroll-lock-recovery";
import { PlatformHeader } from "@/components/layout/platform-header";

export function PlatformChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BodyScrollLockRecovery />
      <PlatformHeader />
      <div className="flex flex-col pt-[3.25rem] sm:pt-14">{children}</div>
    </div>
  );
}
