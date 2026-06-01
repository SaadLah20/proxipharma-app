"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, Phone, Share2, ShieldAlert, Star } from "lucide-react";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import { hasPharmacyNavigation } from "@/lib/pharmacy-navigation";
import type { AnnuairePharmacyEnriched } from "@/lib/annuaire/types";
import { formatDistanceKm } from "@/lib/annuaire/geo";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { buttonVariants } from "@/components/ui/button";
import { uiAnnuaireQuickAction } from "@/lib/ui-action-buttons";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { cn } from "@/lib/utils";
import {
  pharmacyOnCallCardBannerClass,
  pharmacyOnCallOverlayBadgeClass,
  pharmacyOpenStatusOverlayBadgeClass,
} from "@/lib/pharmacy-open-status-ui";

function normalizeWhatsApp(value: string | null) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export function AnnuairePharmacyCard({ pharmacy }: { pharmacy: AnnuairePharmacyEnriched }) {
  const coverUrl = resolvePublicMediaUrl(pharmacy.cover_image_path ?? pharmacy.logo_url ?? null);
  const wa = normalizeWhatsApp(pharmacy.whatsapp);
  const canNavigate = hasPharmacyNavigation(pharmacy);
  const publicRef = pharmacy.public_ref?.trim() ?? "";

  const ratingCount = pharmacy.rating_count ?? 0;
  const ratingLabel =
    ratingCount > 0
      ? `${Number(pharmacy.rating_avg ?? 0).toFixed(1)} (${ratingCount} avis)`
      : "Pas encore d\u2019avis";

  const handleShare = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/pharmacie/${pharmacy.id}` : "";
    const label = pharmacyPublicLabel(pharmacy.nom);
    const title = publicRef ? `${label} (${publicRef})` : label;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard && url) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* annulé ou indisponible */
    }
  };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition hover:shadow-md",
        pharmacy.open.onCallNow
          ? "border-amber-400/70 ring-2 ring-amber-300/40 hover:border-amber-400/80"
          : pharmacy.open.onCallToday
            ? "border-amber-300/50 ring-1 ring-amber-200/35 hover:border-amber-300/65"
            : "border-border hover:border-primary/25"
      )}
    >
      <Link
        href={`/pharmacie/${pharmacy.id}`}
        className="group relative block w-full overflow-hidden bg-muted/30"
        onClick={() =>
          trackPharmacyEngagement({
            pharmacyId: pharmacy.id,
            eventType: "profile_view",
            source: "annuaire",
          })
        }
      >
        <div className="aspect-[21/9] w-full">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/40">
              <span className="text-4xl font-bold text-primary/30">{pharmacy.nom.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <span className="absolute right-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-0.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Star className="size-3 shrink-0 fill-amber-300 text-amber-300" aria-hidden />
          <span className="truncate">{ratingLabel}</span>
        </span>
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span className={pharmacyOpenStatusOverlayBadgeClass(pharmacy.open.status)}>
              {pharmacy.open.openLabel}
            </span>
            {pharmacy.open.onCallNow ? (
              <span className={pharmacyOnCallOverlayBadgeClass(true)}>En garde</span>
            ) : pharmacy.open.onCallToday ? (
              <span className={pharmacyOnCallOverlayBadgeClass(false)}>Garde auj.</span>
            ) : null}
          </div>
          {pharmacy.distanceKm != null ? (
            <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {formatDistanceKm(pharmacy.distanceKm)}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-1 border-b border-border/60 p-2">
        <a
          href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
          aria-disabled={!pharmacy.telephone}
          onClick={(e) => {
            if (!pharmacy.telephone) e.preventDefault();
            else
              trackPharmacyEngagement({
                pharmacyId: pharmacy.id,
                eventType: "phone_click",
                source: "annuaire",
              });
          }}
          className={cn(uiAnnuaireQuickAction(), !pharmacy.telephone && "pointer-events-none opacity-45")}
        >
          <Phone className="size-4" aria-hidden />
          Appeler
        </a>
        <a
          href={wa ? `https://wa.me/${wa}` : undefined}
          target={wa ? "_blank" : undefined}
          rel={wa ? "noreferrer" : undefined}
          aria-disabled={!wa}
          onClick={(e) => {
            if (!wa) e.preventDefault();
            else
              trackPharmacyEngagement({
                pharmacyId: pharmacy.id,
                eventType: "whatsapp_click",
                source: "annuaire",
              });
          }}
          className={cn(uiAnnuaireQuickAction(), !wa && "pointer-events-none opacity-45")}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <PharmacyNavigationPicker
          pharmacy={{
            pharmacyId: pharmacy.id,
            nom: pharmacy.nom,
            adresse: pharmacy.adresse,
            ville: pharmacy.ville,
            latitude: pharmacy.latitude,
            longitude: pharmacy.longitude,
            maps_url: pharmacy.maps_url,
          }}
          source="annuaire"
          variant="annuaire"
          disabledClassName={!canNavigate ? "pointer-events-none opacity-45" : undefined}
        />
      </div>

      <div className="space-y-1.5 p-3 pt-2">
        {pharmacy.open.onCallNow || pharmacy.open.onCallToday ? (
          <div
            className={pharmacyOnCallCardBannerClass(pharmacy.open.onCallNow)}
            role="status"
          >
            <ShieldAlert className="size-3.5 shrink-0 opacity-90" aria-hidden />
            <span>
              {pharmacy.open.onCallNow
                ? "Pharmacie de garde — ouverte en permanence"
                : "Pharmacie de garde aujourd'hui"}
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <div
            className="flex min-w-0 flex-1 items-baseline gap-1.5"
            title={publicRef ? `${pharmacyPublicLabel(pharmacy.nom)} · ${publicRef}` : pharmacyPublicLabel(pharmacy.nom)}
          >
            <h2 className="min-w-0 truncate text-base font-bold leading-tight text-foreground">
              {pharmacyPublicLabel(pharmacy.nom)}
            </h2>
            {publicRef ? (
              <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-primary">{publicRef}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => void handleShare(e)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 text-foreground transition hover:bg-muted/70"
            aria-label={`Partager ${pharmacyPublicLabel(pharmacy.nom)}`}
          >
            <Share2 className="size-3.5" aria-hidden />
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden />
          <span>
            {pharmacy.adresse}
            {pharmacy.ville ? `, ${pharmacy.ville}` : ""}
          </span>
        </p>
        {!pharmacy.hasValidLocation ? (
          <p className="text-[10px] text-muted-foreground">Position GPS non renseignée — tri par distance indisponible.</p>
        ) : null}
        <Link
          href={`/pharmacie/${pharmacy.id}`}
          className={cn(buttonVariants({ size: "sm" }), "h-9 w-full gap-1.5 text-xs font-semibold")}
        >
          Voir la fiche
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
