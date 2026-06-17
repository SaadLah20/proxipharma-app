"use client";

import {
  AlertCircle,
  Calculator,
  ClipboardList,
  Flag,
  Gift,
  Package,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";
import type { PharmacistDashboardSnapshot } from "@/lib/pharmacist-dashboard";
import { dayOverrideLabelFr } from "@/lib/pharmacist-dashboard";
import { DashboardMetricTile } from "@/components/pharmacist/dashboard/metric-tile";

export function PharmacistDashboardOperationsGrid({ snapshot }: { snapshot: PharmacistDashboardSnapshot }) {
  const { operations, clients, promo_reservations, schedule, ratings } = snapshot;

  const catalogHint =
    operations.catalog_draft > 0
      ? `${operations.catalog_published} publié(s) · ${operations.catalog_draft} brouillon(s)`
      : `${operations.catalog_published} publié(s)`;

  const pricingHint =
    operations.pricing_brand_rules_count > 0
      ? `Marge globale ${operations.pricing_global_margin_pct >= 0 ? "+" : ""}${operations.pricing_global_margin_pct} % · ${operations.pricing_brand_rules_count} marque(s)`
      : `Marge globale ${operations.pricing_global_margin_pct >= 0 ? "+" : ""}${operations.pricing_global_margin_pct} %`;

  const clientsHint =
    clients.new_in_period > 0 ? `+${clients.new_in_period} sur la période` : "Ayant interagi avec l'officine";

  const promoHint =
    operations.promo_offers_active > 0
      ? `${promo_reservations.pending} réservation(s) · ${operations.promo_offers_active} offre(s) active(s)`
      : `${promo_reservations.pending} réservation(s) en attente`;

  const ratingsValue =
    ratings.total_count > 0 ? `${ratings.average_score.toFixed(1).replace(".", ",")}/5` : "—";
  const ratingsHint =
    ratings.total_count > 0 ? `${ratings.total_count} avis patient(s)` : "Aucun avis pour le moment";

  const override = schedule.next_day_override;
  const overrideValue = override ? "1" : "—";
  const overrideHint = override ? dayOverrideLabelFr(override) : "Aucune exception planifiée";

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <DashboardMetricTile
        icon={Users}
        label="Clients"
        value={clients.distinct_total}
        hint={clientsHint}
        href="/dashboard/pharmacien/clients"
      />
      <DashboardMetricTile
        icon={ClipboardList}
        label="Produits commandés"
        value={operations.ordered_pending}
        hint="Lignes en attente de réception"
        href="/dashboard/pharmacien/produits-commandes"
        emphasize={operations.ordered_pending > 0}
      />
      <DashboardMetricTile
        icon={AlertCircle}
        label="Ruptures marché"
        value={operations.shortage_active}
        hint="Produits catalogue national"
        href="/dashboard/pharmacien/ruptures-marche"
        emphasize={operations.shortage_active > 0}
      />
      <DashboardMetricTile
        icon={Gift}
        label="Packs promo"
        value={promo_reservations.pending}
        hint={promoHint}
        href="/dashboard/pharmacien/reservations-packs"
        emphasize={promo_reservations.pending > 0}
      />
      <DashboardMetricTile
        icon={ShoppingBag}
        label="Mes produits"
        value={operations.catalog_published}
        hint={catalogHint}
        href="/dashboard/pharmacien/mes-produits"
      />
      <DashboardMetricTile
        icon={Flag}
        label="Produits signalés"
        value={operations.catalog_reports_open}
        hint={
          operations.catalog_reports_open > 0 ? "Signalements à traiter" : "Aucun signalement ouvert"
        }
        href="/dashboard/pharmacien/produits-signales"
        muted={operations.catalog_reports_open === 0}
        emphasize={operations.catalog_reports_open > 0}
      />
      <DashboardMetricTile
        icon={Calculator}
        label="Règles pricing"
        value={operations.pricing_brand_rules_count}
        hint={pricingHint}
        href="/dashboard/pharmacien/pricing"
      />
      <DashboardMetricTile
        icon={Package}
        label="Horaires exceptionnels"
        value={overrideValue}
        hint={overrideHint}
        href="/dashboard/pharmacien/horaires-garde"
        muted={!override}
      />
      <DashboardMetricTile
        icon={Star}
        label="Avis patients"
        value={ratingsValue}
        hint={ratingsHint}
        href="/dashboard/pharmacien/avis-patients"
        muted={ratings.total_count === 0}
      />
    </div>
  );
}
