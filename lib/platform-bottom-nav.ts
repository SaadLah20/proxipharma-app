import type { LucideIcon } from "lucide-react";
import { CalendarClock, FileText, Gift, MessageSquare, Package } from "lucide-react";

export const PLATFORM_BOTTOM_NAV_HEIGHT_PX = 56;

export type BottomNavRole = "patient" | "pharmacien";

export type BottomNavTabId = "products" | "prescriptions" | "consultations" | "promos";

export type BottomNavTabConfig = {
  id: BottomNavTabId;
  href: string;
  icon: LucideIcon;
  /** i18n key under header.bottomNav */
  labelKey: "products" | "prescriptions" | "consultations" | "promos" | "demandes" | "reservations";
};

const PATIENT_TABS: BottomNavTabConfig[] = [
  { id: "products", href: "/dashboard/demandes", icon: Package, labelKey: "products" },
  { id: "prescriptions", href: "/dashboard/patient/ordonnances", icon: FileText, labelKey: "prescriptions" },
  { id: "consultations", href: "/dashboard/patient/consultations-libres", icon: MessageSquare, labelKey: "consultations" },
  { id: "promos", href: "/dashboard/patient/packs-promo", icon: Gift, labelKey: "promos" },
];

const PHARMACIEN_TABS: BottomNavTabConfig[] = [
  { id: "products", href: "/dashboard/pharmacien/demandes", icon: Package, labelKey: "demandes" },
  { id: "prescriptions", href: "/dashboard/pharmacien/ordonnances", icon: FileText, labelKey: "prescriptions" },
  { id: "consultations", href: "/dashboard/pharmacien/consultations-libres", icon: MessageSquare, labelKey: "consultations" },
  { id: "promos", href: "/dashboard/pharmacien/reservations-packs", icon: CalendarClock, labelKey: "reservations" },
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

/** Détail dossier partagé (`/dashboard/demandes/[id]`) — l’URL ne reflète pas le type. */
export function isSharedDemandeDetailPath(pathname: string, role: BottomNavRole): boolean {
  const normalized = pathname.split("?")[0] ?? pathname;
  if (role === "patient") {
    return normalized.startsWith("/dashboard/demandes/") && normalized !== "/dashboard/demandes";
  }
  return (
    normalized.startsWith("/dashboard/pharmacien/demandes/") && normalized !== "/dashboard/pharmacien/demandes"
  );
}

export function isBottomNavTabActive(
  pathname: string,
  tab: BottomNavTabConfig,
  role: BottomNavRole,
  dossierTabId?: BottomNavTabId | null
): boolean {
  const normalized = pathname.split("?")[0] ?? pathname;

  if (isSharedDemandeDetailPath(pathname, role)) {
    if (!dossierTabId) return false;
    return tab.id === dossierTabId;
  }

  if (tab.id === "products") {
    if (role === "patient") {
      return normalized === "/dashboard/demandes" || normalized.startsWith("/dashboard/demandes/");
    }
    return normalized === "/dashboard/pharmacien/demandes" || normalized.startsWith("/dashboard/pharmacien/demandes/");
  }

  if (tab.id === "prescriptions") {
    if (role === "patient") {
      return normalized === "/dashboard/patient/ordonnances" || normalized.startsWith("/dashboard/patient/ordonnances/");
    }
    return (
      normalized === "/dashboard/pharmacien/ordonnances" ||
      normalized.startsWith("/dashboard/pharmacien/ordonnances/")
    );
  }

  if (tab.id === "consultations") {
    if (role === "patient") {
      return (
        normalized === "/dashboard/patient/consultations-libres" ||
        normalized.startsWith("/dashboard/patient/consultations-libres/")
      );
    }
    return (
      normalized === "/dashboard/pharmacien/consultations-libres" ||
      normalized.startsWith("/dashboard/pharmacien/consultations-libres/")
    );
  }

  if (tab.id === "promos") {
    if (role === "patient") {
      return normalized === "/dashboard/patient/packs-promo" || normalized.startsWith("/dashboard/patient/packs-promo/");
    }
    return (
      normalized === "/dashboard/pharmacien/reservations-packs" ||
      normalized.startsWith("/dashboard/pharmacien/reservations-packs/")
    );
  }

  return normalized === tab.href || normalized.startsWith(`${tab.href}/`);
}

export function platformBottomNavPadClass(): string {
  return "pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(3.75rem+env(safe-area-inset-bottom))]";
}

export function platformBottomNavFabMinBottomPx(): number {
  return PLATFORM_BOTTOM_NAV_HEIGHT_PX + 16;
}
