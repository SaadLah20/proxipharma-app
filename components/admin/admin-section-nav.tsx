"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { activeAdminSectionId, ADMIN_SECTION_NAV } from "@/lib/admin-nav";

export function AdminSectionNav() {
  const pathname = usePathname() ?? "/admin";
  const active = activeAdminSectionId(pathname);

  return (
    <nav
      aria-label="Sections administration"
      className="sticky top-[3.25rem] z-40 -mx-1 border-b border-border/80 bg-background/95 py-2 backdrop-blur-sm sm:top-14"
    >
      <div className="flex gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ADMIN_SECTION_NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.id === "dashboard"
              ? active === "dashboard"
              : item.id === active;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={clsx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon className="size-3.5 shrink-0 sm:size-4" strokeWidth={2} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
