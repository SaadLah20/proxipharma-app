"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  Info,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  ShoppingBag,
  Star,
  Tag,
} from "lucide-react";
import { clsx } from "clsx";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import {
  buildCurrentWeekScheduleFr,
  resolvePharmacyOpenStatus,
} from "@/lib/pharmacy-schedule-fr";
import type {
  PharmacyDayOverrideRow,
  PharmacyOnCallPeriodRow,
  PharmacyPublicProfileRow,
  PharmacyServiceCatalogRow,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";
import { PublicPromoOffers } from "@/components/promo/public-promo-offers";
import { PharmacySegmentTabs } from "@/components/pharmacy/pharmacy-segment-tabs";
import { PharmacyRatingForm } from "@/components/pharmacy/pharmacy-rating-form";
import {
  PHARMACY_CONTACT_ICONS,
  PharmacyProfileContactGrid,
  type PharmacyProfileContactItem,
} from "@/components/pharmacy/pharmacy-profile-contact-grid";
import {
  PharmacyPublicInfoBlock,
  PharmacyPublicSectionTitle,
  pharmacyPublicCard,
} from "@/components/pharmacy/pharmacy-public-chrome";
import { PharmacyNavigationPicker } from "@/components/pharmacy/pharmacy-navigation-picker";
import {
  PharmacyRequestServiceLinks,
  PharmacyRequestServicesIntro,
} from "@/components/pharmacy/pharmacy-request-service-links";
import { hasPharmacyNavigation } from "@/lib/pharmacy-navigation";
import { cn } from "@/lib/utils";
import type { PharmacyDayScheduleLine, PharmacyOpenStatus } from "@/lib/pharmacy-profile-types";
import {
  pharmacyOpenStatusInlineBadgeClass,
  pharmacyOpenStatusOverlayBadgeClass,
  pharmacyScheduleLineBadgeClass,
} from "@/lib/pharmacy-open-status-ui";

type TabId = "services" | "promos" | "hours" | "info";

const TABS = [
  { id: "services" as const, label: "Services", icon: ShoppingBag },
  { id: "promos" as const, label: "Offres", icon: Tag },
  { id: "hours" as const, label: "Horaires", icon: Clock },
  { id: "info" as const, label: "Infos", icon: Info },
];

function normalizeWhatsApp(value: string | null) {
  return (value ?? "").replace(/[^\d]/g, "");
}

function ScheduleLineBadge({ line }: { line: string }) {
  return <span className={pharmacyScheduleLineBadgeClass(line)}>{line}</span>;
}

function PharmacyWeekScheduleView({
  days,
  openLabel,
  openStatus,
}: {
  days: PharmacyDayScheduleLine[];
  openLabel: string;
  openStatus: PharmacyOpenStatus;
}) {
  const today = days.find((d) => d.isToday);

  return (
    <div className="space-y-3">
      {today ? (
        <div className={cn(pharmacyPublicCard, "border-border/80 bg-card p-4")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              Aujourd&apos;hui · {today.weekdayLabel} {today.dateLabel}
            </p>
            <span className={pharmacyOpenStatusInlineBadgeClass(openStatus)}>{openLabel}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {today.lines.map((line, i) => (
              <ScheduleLineBadge key={i} line={line} />
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">7 prochains jours</p>
      <ul className={cn(pharmacyPublicCard, "divide-y divide-border/60 overflow-hidden p-0")}>
        {days.map((day) => (
          <li
            key={day.dateIso}
            className={clsx(
              "flex gap-3 px-3 py-2.5 sm:gap-4",
              day.isToday && "bg-primary/[0.04]",
              day.isOnCallFullDay && !day.isToday && "bg-amber-50/50",
              day.isException && !day.isToday && !day.isOnCallFullDay && "bg-amber-50/40"
            )}
          >
            <div className="min-w-[5.5rem] shrink-0 sm:min-w-[6.5rem]">
              <p className={clsx("text-[11px] font-bold leading-tight", day.isToday ? "text-primary" : "text-foreground")}>
                {day.weekdayLabel}
              </p>
              <p className="text-[10px] text-muted-foreground">{day.dateLabel}</p>
              {day.isOnCallFullDay ? (
                <span className="mt-0.5 inline-block text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                  Garde
                </span>
              ) : day.isException ? (
                <span className="mt-0.5 inline-block text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                  {day.lines[0]?.startsWith("Férié") ? "Férié" : "Exception"}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 flex flex-wrap content-start gap-1">
              {day.lines.map((line, i) => (
                <ScheduleLineBadge key={i} line={line} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PharmacyPublicProfile({
  pharmacy,
  weeklyHours,
  dayOverrides,
  onCallPeriods,
  serviceIds,
  serviceCatalog,
}: {
  pharmacy: PharmacyPublicProfileRow;
  weeklyHours: PharmacyWeeklyHourRow[];
  dayOverrides: PharmacyDayOverrideRow[];
  onCallPeriods: PharmacyOnCallPeriodRow[];
  serviceIds: string[];
  serviceCatalog: PharmacyServiceCatalogRow[];
}) {
  const [tab, setTab] = useState<TabId>("services");
  const [navOpen, setNavOpen] = useState(false);
  const [ratingAvg, setRatingAvg] = useState<number | null>(pharmacy.rating_avg ?? null);
  const [ratingCount, setRatingCount] = useState<number | null>(pharmacy.rating_count ?? null);
  const canNavigate = hasPharmacyNavigation(pharmacy);

  const coverUrl = resolvePublicMediaUrl(pharmacy.cover_image_path ?? null);
  const logoUrl = resolvePublicMediaUrl(pharmacy.logo_url ?? null);
  const wa = normalizeWhatsApp(pharmacy.whatsapp);
  const openState = useMemo(
    () => resolvePharmacyOpenStatus(weeklyHours, dayOverrides, onCallPeriods),
    [weeklyHours, dayOverrides, onCallPeriods]
  );
  const weekLines = useMemo(
    () => buildCurrentWeekScheduleFr(weeklyHours, dayOverrides, onCallPeriods),
    [weeklyHours, dayOverrides, onCallPeriods]
  );

  const servicesOffered = useMemo(() => {
    const set = new Set(serviceIds);
    return serviceCatalog.filter((s) => set.has(s.id));
  }, [serviceIds, serviceCatalog]);

  const contactItems = useMemo((): PharmacyProfileContactItem[] => {
    const tel = pharmacy.telephone?.trim();
    return [
      {
        id: "phone",
        label: "Appeler",
        detail: tel ?? undefined,
        href: tel ? `tel:${tel}` : undefined,
        icon: PHARMACY_CONTACT_ICONS.phone,
        tone: "phone",
        onClick: () =>
          trackPharmacyEngagement({ pharmacyId: pharmacy.id, eventType: "phone_click", source: "profile" }),
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        detail: wa ? "Message" : undefined,
        href: wa ? `https://wa.me/${wa}` : undefined,
        icon: PHARMACY_CONTACT_ICONS.whatsapp,
        tone: "whatsapp",
        onClick: () =>
          trackPharmacyEngagement({ pharmacyId: pharmacy.id, eventType: "whatsapp_click", source: "profile" }),
      },
      {
        id: "maps",
        label: "Itinéraire",
        detail: canNavigate ? "Google, Waze…" : undefined,
        icon: PHARMACY_CONTACT_ICONS.maps,
        tone: "maps",
        onClick: canNavigate
          ? () => {
              trackPharmacyEngagement({
                pharmacyId: pharmacy.id,
                eventType: "maps_click",
                source: "profile",
              });
              setNavOpen(true);
            }
          : undefined,
      },
      {
        id: "email",
        label: "E-mail",
        detail: pharmacy.email?.trim() ?? undefined,
        href: pharmacy.email?.trim() ? `mailto:${pharmacy.email.trim()}` : undefined,
        icon: PHARMACY_CONTACT_ICONS.email,
        tone: "neutral",
      },
      {
        id: "website",
        label: "Site web",
        href: pharmacy.website_url ?? undefined,
        icon: PHARMACY_CONTACT_ICONS.website,
        tone: "neutral",
      },
      {
        id: "facebook",
        label: "Facebook",
        href: pharmacy.facebook_url ?? undefined,
        icon: PHARMACY_CONTACT_ICONS.facebook,
        tone: "neutral",
      },
      {
        id: "instagram",
        label: "Instagram",
        href: pharmacy.instagram_url ?? undefined,
        icon: PHARMACY_CONTACT_ICONS.instagram,
        tone: "neutral",
      },
    ];
  }, [pharmacy, wa, canNavigate]);

  const ratingLabel =
    (ratingCount ?? 0) > 0 ? `${Number(ratingAvg ?? 0).toFixed(1)} (${ratingCount} avis)` : "Pas encore d'avis";

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: pharmacyPublicLabel(pharmacy.nom), url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <article className={cn("overflow-hidden", pharmacyPublicCard, "shadow-md ring-1 ring-black/5")}>
      <div className="relative w-full overflow-hidden bg-muted/40">
        <div className="aspect-[21/9] w-full">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover object-center" />
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <button
          type="button"
          onClick={() => void handleShare()}
          className="absolute right-2 top-2 inline-flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
          aria-label="Partager"
        >
          <Share2 className="size-4" aria-hidden />
        </button>
        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 p-3 text-white">
          {logoUrl ? (
            <div className="size-14 shrink-0 overflow-hidden rounded-2xl border-2 border-white/90 bg-white shadow-lg sm:size-16">
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 pb-0.5">
            {pharmacy.public_ref?.trim() ? (
              <p className="font-mono text-[10px] font-bold tracking-wide opacity-90">{pharmacy.public_ref.trim()}</p>
            ) : null}
            <h1 className="text-lg font-bold leading-tight drop-shadow-sm sm:text-xl">
              {pharmacyPublicLabel(pharmacy.nom)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={pharmacyOpenStatusOverlayBadgeClass(openState.status)}>
                {openState.openLabel}
              </span>
              {openState.onCallToday ? (
                <span
                  className={clsx(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                    openState.onCallNow
                      ? "bg-amber-400 text-amber-950 ring-1 ring-amber-500/60"
                      : "bg-amber-400/85 text-amber-950"
                  )}
                >
                  {openState.onCallNow ? "De garde · en cours" : "De garde aujourd'hui"}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-0.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                <Star className="size-3 fill-amber-300 text-amber-300" aria-hidden />
                {ratingLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <PharmacySegmentTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Sections fiche pharmacie" />

      <div className="p-3 sm:p-4">
        {tab === "services" ? (
          <div className="space-y-3">
            <PharmacyRequestServicesIntro />
            <PharmacyRequestServiceLinks pharmacyId={pharmacy.id} />
          </div>
        ) : null}

        {tab === "promos" ? <PublicPromoOffers pharmacyId={pharmacy.id} /> : null}

        {tab === "hours" ? (
          <div className="space-y-3">
            <PharmacyPublicSectionTitle
              title="Horaires & gardes"
              hint="Statut du jour et planning sur les 7 prochains jours."
            />
            <PharmacyWeekScheduleView
              days={weekLines}
              openLabel={openState.openLabel}
              openStatus={openState.status}
            />
          </div>
        ) : null}

        {tab === "info" ? (
          <div className="space-y-3">
            <PharmacyPublicSectionTitle
              title="Informations"
              hint="Coordonnées, avis et services proposés par l'officine."
            />

            {pharmacy.welcome_text?.trim() ? (
              <div className={cn(pharmacyPublicCard, "border-dashed bg-gradient-to-br from-emerald-50/30 to-card p-3 text-[12px] leading-relaxed text-foreground/90")}>
                {pharmacy.welcome_text.trim()}
              </div>
            ) : null}

            <PharmacyPublicInfoBlock title="Adresse">
              <p className="flex items-start gap-2 text-[12px] leading-snug text-foreground">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
                  <MapPin className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="font-semibold">{pharmacy.adresse}</span>
                  <br />
                  <span className="text-muted-foreground">{pharmacy.ville}</span>
                </span>
              </p>
            </PharmacyPublicInfoBlock>

            <PharmacyPublicInfoBlock title="Contact">
              <PharmacyProfileContactGrid items={contactItems} />
            </PharmacyPublicInfoBlock>

            <PharmacyRatingForm
              pharmacyId={pharmacy.id}
              ratingAvg={ratingAvg}
              ratingCount={ratingCount}
              onUpdated={(avg, count) => {
                setRatingAvg(avg);
                setRatingCount(count);
              }}
            />

            {pharmacy.titular_public !== false && pharmacy.titular_name?.trim() ? (
              <PharmacyPublicInfoBlock title={pharmacy.titular_title?.trim() || "Pharmacien titulaire"}>
                <p className="text-[12px] font-semibold text-foreground">{pharmacy.titular_name.trim()}</p>
              </PharmacyPublicInfoBlock>
            ) : null}

            <PharmacyPublicInfoBlock title="Services en officine">
              {servicesOffered.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {servicesOffered.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-950"
                    >
                      {s.label_fr}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">Liste non renseignée par l&apos;officine.</p>
              )}
            </PharmacyPublicInfoBlock>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-1 border-t border-border/60 bg-muted/15 p-2 sm:hidden">
        <a
          href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
          aria-disabled={!pharmacy.telephone}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg border border-sky-200/80 bg-sky-50/90 py-2 text-[10px] font-bold text-sky-950",
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
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 py-2 text-[10px] font-bold text-emerald-950",
            !wa && "pointer-events-none opacity-45"
          )}
        >
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <button
          type="button"
          disabled={!canNavigate}
          onClick={() => canNavigate && setNavOpen(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg border border-teal-200/80 bg-teal-50/90 py-2 text-[10px] font-bold text-teal-950",
            !canNavigate && "pointer-events-none opacity-45"
          )}
        >
          <Navigation className="size-4" aria-hidden />
          Itinéraire
        </button>
      </div>

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
        source="profile"
        hideTrigger
        open={navOpen}
        onOpenChange={setNavOpen}
      />
    </article>
  );
}
