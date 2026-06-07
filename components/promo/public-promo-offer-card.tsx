"use client";

import Link from "next/link";
import { CalendarClock, ChevronDown, Package } from "lucide-react";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { formatPromoValidityFr } from "@/lib/promo/dates";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoOfferRow } from "@/lib/promo/types";
import { cn } from "@/lib/utils";

export type PublicPromoOfferBundle = PromoOfferRow & {
  lines: PromoLineWithPrice[];
};

function promoPackMetaLines(lines: PromoLineWithPrice[]) {
  const products = lines.filter((l) => l.line_kind === "product");
  const gifts = lines.filter((l) => l.line_kind === "gift");
  const linesOut: string[] = [];
  if (products.length > 0) {
    const units = products.reduce((s, l) => s + l.quantity, 0);
    linesOut.push(
      `${products.length} produit${products.length > 1 ? "s" : ""} · ${units} unité${units > 1 ? "s" : ""}`
    );
  }
  if (gifts.length > 0) {
    const giftUnits = gifts.reduce((s, l) => s + l.quantity, 0);
    linesOut.push(
      `${gifts.length} ${gifts.length > 1 ? "cadeaux" : "cadeau"}${giftUnits > gifts.length ? ` · ${giftUnits} offerts` : ""}`
    );
  }
  return linesOut;
}

function PublicPromoOfferBanner({
  offer,
  metaLines,
  existingReservationId,
  expanded,
  collapsible,
  roundedClassName,
}: {
  offer: PublicPromoOfferBundle;
  metaLines: string[];
  existingReservationId?: string;
  expanded: boolean;
  collapsible: boolean;
  /** Coins du bandeau alignés sur la carte (ex. `rounded-t-2xl` ou `rounded-2xl`). */
  roundedClassName: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden px-3 py-2.5",
        pt.bannerGradient,
        roundedClassName
      )}
    >
      <div
        className={cn("pointer-events-none absolute -right-6 -top-6 size-24 rounded-full blur-2xl", pt.bannerOrb)}
        aria-hidden
      />
      <div className="relative flex items-start gap-2.5">
        <div className="relative mt-0.5 shrink-0" aria-hidden>
          <span className={cn("flex size-10 items-center justify-center rounded-xl text-white shadow-md", pt.iconBadge, pt.iconRing)}>
            <Package className="size-5" strokeWidth={2.25} />
          </span>
          <span
            className={cn(
              "absolute -bottom-1 -right-1 rounded-md px-1 py-px text-[9px] font-bold leading-none tabular-nums shadow-sm ring-2 ring-white",
              pt.discountBadge,
            )}
            aria-label={`Remise ${offer.discount_percent} pour cent`}
          >
            −{offer.discount_percent}%
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground [overflow-wrap:anywhere]">
              {offer.title}
            </h3>
            {existingReservationId ? (
              <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-tight", pt.reservedPill)}>
                Réservé
              </span>
            ) : null}
          </div>
          <p className="text-[10px] font-medium text-muted-foreground">Pack promotionnel</p>
          <div className="space-y-0.5 text-[10px] leading-snug text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <CalendarClock className="mt-px size-3 shrink-0 opacity-70" aria-hidden />
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {formatPromoValidityFr(offer.valid_from, offer.valid_until)}
              </span>
            </p>
            {metaLines.map((line) => (
              <p key={line} className="pl-[1.125rem] [overflow-wrap:anywhere]">
                {line}
              </p>
            ))}
          </div>
        </div>

        {collapsible ? (
          <span className="flex shrink-0 self-center pl-0.5 pt-1 text-muted-foreground/70" aria-hidden>
            <ChevronDown
              className={cn("size-5 transition-transform", expanded && "rotate-180")}
            />
          </span>
        ) : null}
      </div>

      {offer.description?.trim() ? (
        <p
          className={cn(
            "relative mt-2 w-full break-words rounded-lg border px-2 py-1.5 text-[11px] leading-snug text-foreground/85",
            pt.descriptionInset,
            collapsible && !expanded && "line-clamp-2"
          )}
        >
          {offer.description.trim()}
        </p>
      ) : null}
    </div>
  );
}

export function PublicPromoOfferCard({
  offer,
  pharmacyId,
  session = null,
  existingReservationId,
  onReserve,
  expanded = true,
  collapsible = false,
  onToggle,
  previewMode = false,
}: {
  offer: PublicPromoOfferBundle;
  pharmacyId: string;
  session?: boolean | null;
  existingReservationId?: string;
  onReserve?: () => void;
  /** Corps visible (détail + bouton). */
  expanded?: boolean;
  /** Bandeau cliquable pour replier / déplier. */
  collapsible?: boolean;
  onToggle?: () => void;
  /** Aperçu pharmacien : pas d’actions patient, bouton factice. */
  previewMode?: boolean;
}) {
  const metaLines = promoPackMetaLines(offer.lines);
  const showBody = expanded || !collapsible;

  const bannerRounded = showBody ? "rounded-t-2xl" : "rounded-2xl";

  const banner = (
    <PublicPromoOfferBanner
      offer={offer}
      metaLines={metaLines}
      existingReservationId={existingReservationId}
      expanded={expanded}
      collapsible={collapsible}
      roundedClassName={bannerRounded}
    />
  );

  return (
    <article
      className={cn(
        pharmacyPublicCard,
        "overflow-hidden border-l-[3px]",
        pt.cardAccentBorder,
      )}
    >
      {collapsible ? (
        <button
          type="button"
          className={cn(
            "block w-full p-0 text-left transition-opacity hover:opacity-95",
            showBody && cn("border-b", pt.cardDivider)
          )}
          aria-expanded={expanded}
          onClick={onToggle}
        >
          {banner}
        </button>
      ) : (
        <header className={cn("border-b p-0", pt.cardDivider)}>{banner}</header>
      )}

      {showBody ? (
      <div className="space-y-2.5 p-3">
        <PromoOfferPackSummary lines={offer.lines} discountPercent={offer.discount_percent} variant="public" />

        {previewMode ? (
          <>
            <div
              className="flex w-full cursor-default items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              aria-hidden
            >
              Réserver ce pack
            </div>
            <p className="text-center text-[10px] text-muted-foreground">
              Visible par les patients connectés sur la fiche publique
            </p>
          </>
        ) : session === false ? (
          <Link
            href={`/auth?redirect=/pharmacie/${pharmacyId}`}
            className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
          >
            Se connecter pour réserver
          </Link>
        ) : session === true ? (
          existingReservationId ? (
            <Link
              href={`/dashboard/patient/packs-promo/${existingReservationId}`}
              className={cn("flex w-full items-center justify-center rounded-xl border py-2.5 text-sm font-bold", pt.ctaSecondary)}
            >
              Voir ma réservation
            </Link>
          ) : (
            <button
              type="button"
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
              onClick={onReserve}
            >
              Réserver ce pack
            </button>
          )
        ) : (
          <div className="h-10 animate-pulse rounded-xl bg-muted/40" />
        )}
      </div>
      ) : null}
    </article>
  );
}
