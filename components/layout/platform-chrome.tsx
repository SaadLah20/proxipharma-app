"use client";

import type { ReactNode } from "react";
import { PlatformHeader } from "@/components/layout/platform-header";

export function PlatformChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <PlatformHeader />
      <div className="flex flex-1 flex-col pt-14">{children}</div>
    </div>
  );
}
