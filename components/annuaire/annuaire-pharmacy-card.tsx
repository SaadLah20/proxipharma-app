"use client";

import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle, Phone } from "lucide-react";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import { hasPharmacyNavigation } from "@/lib/pharmacy-navigation";
import { clsx } from "clsx";
import type { AnnuairePharmacyEnriched } from "@/lib/annuaire/types";
import { formatDistanceKm } from "@/lib/annuaire/geo";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function normalizeWhatsApp(value: string | null) {
  return (value ?? "").replace(/[^\d]/g, "");
}

export function AnnuairePharmacyCard({ pharmacy }: { pharmacy: AnnuairePharmacyEnriched }) {
  const coverUrl = resolvePublicMediaUrl(pharmacy.cover_image_path ?? pharmacy.logo_url ?? null);
  const wa = normalizeWhatsApp(pharmacy.whatsapp);
  const canNavigate = hasPharmacyNavigation(pharmacy);

  const statusOpen = pharmacy.open.status === "open";

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
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 backdrop-blur-sm",
                statusOpen
                  ? "bg-emerald-500/90 text-white ring-emerald-600/40"
                  : "bg-slate-700/85 text-white ring-slate-600/40"
              )}
            >
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
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg border border-sky-200/80 bg-sky-50/90 py-2 text-[10px] font-bold text-sky-950 transition hover:bg-sky-100",
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
            "flex flex-col items-center gap-0.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 py-2 text-[10px] font-bold text-emerald-950 transition hover:bg-emerald-100",
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

      <div className="space-y-2 p-3 pt-2">
        {pharmacy.public_ref?.trim() ? (
          <p className="font-mono text-[10px] font-bold text-primary">{pharmacy.public_ref.trim()}</p>
        ) : null}
        <h2 className="text-base font-bold leading-snug text-foreground">{pharmacy.nom}</h2>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden />
          <span>
            {pharmacy.adresse}
            {pharmacy.ville ? `, ${pharmacy.ville}` : ""}
          </span>
        </p>
        {!pharmacy.hasValidLocation ? (
          <p className="text-[10px] text-amber-800">Position GPS non renseignée — tri par distance indisponible.</p>
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
