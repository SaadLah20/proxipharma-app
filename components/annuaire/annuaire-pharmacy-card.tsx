"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { PharmacyCoverOverlayActions } from "@/components/pharmacy/pharmacy-cover-overlay-actions";
import { PharmacyRatingOverlayChip } from "@/components/pharmacy/pharmacy-rating-overlay-chip";
import type { AnnuairePharmacyEnriched } from "@/lib/annuaire/types";
import { formatDistanceKm } from "@/lib/annuaire/geo";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { buttonVariants } from "@/components/ui/button";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { cn } from "@/lib/utils";
import {
  pharmacyOnCallOverlayBadgeClass,
  pharmacyOpenStatusOverlayBadgeClass,
} from "@/lib/pharmacy-open-status-ui";

export function AnnuairePharmacyCard({ pharmacy }: { pharmacy: AnnuairePharmacyEnriched }) {
  const coverUrl = resolvePublicMediaUrl(pharmacy.cover_image_path ?? pharmacy.logo_url ?? null);
  const publicRef = pharmacy.public_ref?.trim() ?? "";

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
        "overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition hover:border-primary/20 hover:shadow-md",
        pharmacy.open.onCallBadgeVisible && "border-l-4 border-l-amber-500",
      )}
    >
      <div className="relative aspect-[2.15/1] min-h-[6.25rem] overflow-hidden border-b border-border/60 sm:aspect-[2.25/1]">
        <Link
          href={`/pharmacie/${pharmacy.id}`}
          className="group absolute inset-0 overflow-hidden bg-muted/30"
          onClick={() =>
            trackPharmacyEngagement({
              pharmacyId: pharmacy.id,
              eventType: "profile_view",
              source: "annuaire",
            })
          }
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <span className="text-3xl font-bold text-primary/30">{pharmacy.nom.charAt(0)}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-black/25 to-transparent sm:w-11" />
          <div className="absolute bottom-2 left-2 right-10 z-[1] flex flex-wrap items-end justify-between gap-1.5 sm:right-11">
            <div className="flex max-w-full flex-wrap gap-1">
              <span className={pharmacyOpenStatusOverlayBadgeClass(pharmacy.open.status)}>
                {pharmacy.open.openLabel}
              </span>
              {pharmacy.open.onCallBadgeVisible ? (
                <span className={pharmacyOnCallOverlayBadgeClass(true)}>En garde</span>
              ) : null}
            </div>
            {pharmacy.distanceKm != null ? (
              <span className="shrink-0 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                {formatDistanceKm(pharmacy.distanceKm)}
              </span>
            ) : null}
          </div>
        </Link>

        <PharmacyRatingOverlayChip
          pharmacyId={pharmacy.id}
          ratingAvg={pharmacy.rating_avg ?? null}
          ratingCount={pharmacy.rating_count ?? null}
          className="absolute left-2 top-2"
          onPointerEventCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />

        <PharmacyCoverOverlayActions
          pharmacy={pharmacy}
          source="annuaire"
          onShare={(e) => void handleShare(e)}
        />
      </div>

      <div className="space-y-2 p-3 pt-2">
        <div
          className="flex min-w-0 items-baseline gap-1.5 pe-1"
          title={publicRef ? `${pharmacyPublicLabel(pharmacy.nom)} · ${publicRef}` : pharmacyPublicLabel(pharmacy.nom)}
        >
          <h2 className="min-w-0 truncate text-base font-bold leading-tight text-foreground">
            {pharmacyPublicLabel(pharmacy.nom)}
          </h2>
          {publicRef ? (
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-primary">{publicRef}</span>
          ) : null}
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
