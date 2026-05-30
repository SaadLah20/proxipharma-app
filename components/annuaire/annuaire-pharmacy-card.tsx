"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, Phone, Share2, Star } from "lucide-react";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import { hasPharmacyNavigation } from "@/lib/pharmacy-navigation";
import type { AnnuairePharmacyEnriched } from "@/lib/annuaire/types";
import { formatDistanceKm } from "@/lib/annuaire/geo";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { buttonVariants } from "@/components/ui/button";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { cn } from "@/lib/utils";
import { pharmacyOpenStatusOverlayBadgeClass } from "@/lib/pharmacy-open-status-ui";

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
    <article className="overflow-hidden rounded-2xl border border-border/90 bg-card text-card-foreground shadow-sm transition hover:border-primary/20 hover:shadow-md">
      <Link
        href={`/pharmacie/${pharmacy.id}`}
        className="group relative block w-full overflow-hidden bg-gradient-to-br from-sky-700/15 via-muted/40 to-teal-600/10"
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
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-teal-500/10">
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
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                En garde
              </span>
            ) : pharmacy.open.onCallToday ? (
              <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                Garde auj.
              </span>
            ) : null}
          </div>
          {pharmacy.distanceKm != null ? (
            <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              {formatDistanceKm(pharmacy.distanceKm)}
            </span>
          ) : null}
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <div
            className="flex min-w-0 flex-1 items-baseline gap-1.5"
            title={publicRef ? `${pharmacyPublicLabel(pharmacy.nom)} · ${publicRef}` : pharmacyPublicLabel(pharmacy.nom)}
          >
            <h2 className="min-w-0 truncate text-base font-bold leading-tight text-foreground sm:text-lg">
              {pharmacyPublicLabel(pharmacy.nom)}
            </h2>
            {publicRef ? (
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                {publicRef}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => void handleShare(e)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/30 text-foreground transition hover:bg-muted/50"
            aria-label={`Partager ${pharmacyPublicLabel(pharmacy.nom)}`}
          >
            <Share2 className="size-4" aria-hidden />
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
          <span>
            {pharmacy.adresse}
            {pharmacy.ville ? `, ${pharmacy.ville}` : ""}
          </span>
        </p>
        {!pharmacy.hasValidLocation ? (
          <p className="text-xs text-muted-foreground">Position GPS non renseignée.</p>
        ) : null}
        <Link
          href={`/pharmacie/${pharmacy.id}`}
          className={cn(buttonVariants({ size: "touch" }), "w-full gap-2")}
        >
          Voir la pharmacie
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <div className="flex flex-wrap gap-2">
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
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-10 flex-1 min-w-[88px] gap-1.5 text-xs",
              !pharmacy.telephone && "pointer-events-none opacity-45"
            )}
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
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-10 flex-1 min-w-[88px] gap-1.5 text-xs",
              !wa && "pointer-events-none opacity-45"
            )}
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
      </div>
    </article>
  );
}
