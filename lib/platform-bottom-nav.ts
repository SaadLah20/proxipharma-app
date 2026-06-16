import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Clock,
  Gift,
  LayoutDashboard,
  MapPin,
  Package,
} from "lucide-react";

export const PLATFORM_BOTTOM_NAV_HEIGHT_PX = 56;

export type BottomNavRole = "patient" | "pharmacien";

export type BottomNavTabId = "home" | "requests" | "packs" | "pharmacies" | "dashboard" | "schedule";

export type BottomNavTabConfig = {
  id: BottomNavTabId;
  href: string;
  icon: LucideIcon;
  /** i18n key under header.bottomNav */
  labelKey:
    | "home"
    | "myRequests"
    | "myPacks"
    | "myPharmacies"
    | "dashboard"
    | "demandes"
    | "reservations"
    | "schedule";
};

const PATIENT_TABS: BottomNavTabConfig[] = [
  { id: "home", href: "/", icon: Building2, labelKey: "home" },
  { id: "requests", href: "/dashboard/demandes", icon: ClipboardList, labelKey: "myRequests" },
  { id: "packs", href: "/dashboard/patient/packs-promo", icon: Gift, labelKey: "myPacks" },
  { id: "pharmacies", href: "/dashboard/patient/pharmacies", icon: MapPin, labelKey: "myPharmacies" },
];

const PHARMACIEN_TABS: BottomNavTabConfig[] = [
  { id: "dashboard", href: "/dashboard/pharmacien", icon: LayoutDashboard, labelKey: "dashboard" },
  { id: "requests", href: "/dashboard/pharmacien/demandes", icon: Package, labelKey: "demandes" },
  { id: "packs", href: "/dashboard/pharmacien/reservations-packs", icon: CalendarClock, labelKey: "reservations" },
  { id: "schedule", href: "/dashboard/pharmacien/horaires-garde", icon: Clock, labelKey: "schedule" },
];

export function bottomNavTabsForRole(role: BottomNavRole): BottomNavTabConfig[] {
  return role === "pharmacien" ? PHARMACIEN_TABS : PATIENT_TABS;
}

/** Routes where the global bottom nav must not appear (guest or non-dossier roles). */
export function shouldHideBottomNav(pathname: string, role: string | null, hasSession: boolean): boolean {
  if (!hasSession) return true;
  if (!role || role === "admin") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/admin")) return true;
  return false;
}

/** Détail dossier partagé — l’URL ne reflète pas le hub unifié. */
export function isSharedDemandeDetailPath(pathname: string, role: BottomNavRole): boolean {
  const normalized = pathname.split("?")[0] ?? pathname;
  if (role === "patient") {
    return normalized.startsWith("/dashboard/demandes/") && normalized !== "/dashboard/demandes";
  }
  return (
    normalized.startsWith("/dashboard/pharmacien/demandes/") && normalized !== "/dashboard/pharmacien/demandes"
  );
}

function pathMatchesPrefix(pathname: string, href: string): boolean {
  const normalized = pathname.split("?")[0] ?? pathname;
  return normalized === href || normalized.startsWith(`${href}/`);
}

export function isBottomNavTabActive(
  pathname: string,
  tab: BottomNavTabConfig,
  role: BottomNavRole,
  dossierTabId?: BottomNavTabId | null,
): boolean {
  if (isSharedDemandeDetailPath(pathname, role)) {
    return tab.id === "requests";
  }

  if (dossierTabId) {
    return tab.id === dossierTabId;
  }

  if (tab.id === "home") {
    const normalized = pathname.split("?")[0] ?? pathname;
    return normalized === "/";
  }

  if (tab.id === "requests") {
    if (role === "patient") {
      return pathMatchesPrefix(pathname, "/dashboard/demandes");
    }
    return pathMatchesPrefix(pathname, "/dashboard/pharmacien/demandes");
  }

  if (tab.id === "packs") {
    if (role === "patient") {
      return pathMatchesPrefix(pathname, "/dashboard/patient/packs-promo");
    }
    return pathMatchesPrefix(pathname, "/dashboard/pharmacien/reservations-packs");
  }

  if (tab.id === "pharmacies") {
    return role === "patient" && pathMatchesPrefix(pathname, "/dashboard/patient/pharmacies");
  }

  if (tab.id === "dashboard") {
    const normalized = pathname.split("?")[0] ?? pathname;
    return normalized === "/dashboard/pharmacien";
  }

  if (tab.id === "schedule") {
    return role === "pharmacien" && pathMatchesPrefix(pathname, "/dashboard/pharmacien/horaires-garde");
  }

  return pathMatchesPrefix(pathname, tab.href);
}

export function platformBottomNavPadClass(): string {
  return "pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(3.75rem+env(safe-area-inset-bottom))]";
}

export function platformBottomNavFabMinBottomPx(): number {
  return PLATFORM_BOTTOM_NAV_HEIGHT_PX + 16;
}
