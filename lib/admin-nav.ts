import type { LucideIcon } from "lucide-react";
import { ClipboardList, LayoutDashboard, Package, Store } from "lucide-react";

export type AdminSectionId = "dashboard" | "officines" | "demandes" | "catalogue";

export type AdminSectionNavItem = {
  id: AdminSectionId;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Préfixe de chemin pour détecter l'onglet actif (ex. /admin/demandes inclut le détail). */
  matchPrefix: string;
};

export const ADMIN_SECTION_NAV: AdminSectionNavItem[] = [
  { id: "dashboard", href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, matchPrefix: "/admin" },
  { id: "officines", href: "/admin/officines", label: "Officines", icon: Store, matchPrefix: "/admin/officines" },
  { id: "demandes", href: "/admin/demandes", label: "Demandes", icon: ClipboardList, matchPrefix: "/admin/demandes" },
  {
    id: "catalogue",
    href: "/admin/produits-communautaires",
    label: "Catalogue",
    icon: Package,
    matchPrefix: "/admin/produits-communautaires",
  },
];

/** Onglet actif selon le pathname (dashboard = /admin exact). */
export function activeAdminSectionId(pathname: string): AdminSectionId {
  if (pathname.startsWith("/admin/officines")) return "officines";
  if (pathname.startsWith("/admin/demandes")) return "demandes";
  if (pathname.startsWith("/admin/produits-communautaires")) return "catalogue";
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  return "dashboard";
}
