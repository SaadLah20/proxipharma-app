"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  FileText,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShoppingBag,
  Star,
  Tag,
} from "lucide-react";
import { clsx } from "clsx";
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
import { PharmacySegmentTabs } from "@/components/pharmacy/pharmacy-segment-tabs";
import { PharmacyRatingForm } from "@/components/pharmacy/pharmacy-rating-form";

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

function ContactChip({
  href,
  label,
  disabled,
  onClick,
}: {
  href?: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  if (disabled || !href) {
    return (
      <span className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
        {label} : non renseigné
      </span>
    );
  }
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      onClick={onClick}
      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-[11px] font-semibold text-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted/40"
    >
      {label}
    </a>
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
  const [ratingAvg, setRatingAvg] = useState<number | null>(pharmacy.rating_avg ?? null);
  const [ratingCount, setRatingCount] = useState<number | null>(pharmacy.rating_count ?? null);

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

  const ratingLabel =
    (ratingCount ?? 0) > 0 ? `${Number(ratingAvg ?? 0).toFixed(1)} (${ratingCount} avis)` : "Pas encore d'avis";

  const statusClass =
    openState.status === "open"
      ? "bg-emerald-500/90 text-white ring-emerald-600/50"
      : "bg-slate-600/90 text-white ring-slate-700/50";

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: pharmacy.nom, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-md ring-1 ring-black/5">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-sky-700/20 via-slate-100 to-teal-600/15">
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
            <h1 className="text-lg font-bold leading-tight drop-shadow-sm sm:text-xl">{pharmacy.nom}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className={clsx("rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1", statusClass)}>
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
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Envoyez une demande à cette officine. Le suivi se fait ensuite dans votre espace personnel.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/pharmacie/${pharmacy.id}/demande-produits`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-sky-200/90 bg-gradient-to-br from-sky-50 to-sky-100/80 py-3.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:border-sky-300"
              >
                <ShoppingBag className="size-5 text-sky-700" aria-hidden />
                Demande de produits
              </Link>
              <Link
                href={`/pharmacie/${pharmacy.id}/demande-ordonnance`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-200/90 bg-gradient-to-br from-amber-50 to-amber-100/70 py-3.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-300"
              >
                <FileText className="size-5 text-amber-700" aria-hidden />
                Ordonnance
              </Link>
              <Link
                href={`/pharmacie/${pharmacy.id}/consultation-libre`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-200/90 bg-gradient-to-br from-violet-50 to-violet-100/70 py-3.5 text-sm font-semibold text-violet-950 shadow-sm transition hover:border-violet-300"
              >
                <MessageCircle className="size-5 text-violet-700" aria-hidden />
                Consultation libre
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "promos" ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/15 p-6 text-center">
            <Tag className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Offres spéciales à venir. La pharmacie pourra publier ses promotions depuis son espace officine.
            </p>
          </div>
        ) : null}

        {tab === "hours" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Clock className="size-4 text-primary" aria-hidden />
              Semaine en cours
            </p>
            <ul className="space-y-2">
              {weekLines.map((day) => (
                <li
                  key={day.dateIso}
                  className={clsx(
                    "rounded-xl border px-3 py-2.5 transition",
                    day.isToday ? "border-primary/45 bg-primary/5 ring-1 ring-primary/15" : "border-border/70 bg-muted/10",
                    day.isException && "border-amber-200/90 bg-amber-50/50"
                  )}
                >
                  <p className="text-[11px] font-bold text-foreground">
                    {day.weekdayLabel}
                    <span className="font-normal text-muted-foreground"> · {day.dateLabel}</span>
                    {day.isToday ? (
                      <span className="ms-1.5 rounded-md bg-primary/15 px-1.5 py-px text-[9px] uppercase tracking-wide text-primary">
                        Aujourd&apos;hui
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {day.lines.map((line, i) => (
                      <li key={i} className="text-[11px] leading-snug text-foreground/90">
                        {line}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "info" ? (
          <div className="space-y-4">
            {pharmacy.welcome_text?.trim() ? (
              <p className="rounded-lg bg-muted/20 px-3 py-2 text-[12px] leading-relaxed text-foreground/90">
                {pharmacy.welcome_text.trim()}
              </p>
            ) : null}

            <PharmacyRatingForm
              pharmacyId={pharmacy.id}
              ratingAvg={ratingAvg}
              ratingCount={ratingCount}
              onUpdated={(avg, count) => {
                setRatingAvg(avg);
                setRatingCount(count);
              }}
            />

            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Coordonnées</h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" aria-hidden />
                <span>
                  {pharmacy.adresse}
                  <br />
                  {pharmacy.ville}
                </span>
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <ContactChip
                  href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
                  label="Téléphone"
                  disabled={!pharmacy.telephone}
                  onClick={() =>
                    trackPharmacyEngagement({ pharmacyId: pharmacy.id, eventType: "phone_click", source: "profile" })
                  }
                />
                <ContactChip
                  href={wa ? `https://wa.me/${wa}` : undefined}
                  label="WhatsApp"
                  disabled={!wa}
                  onClick={() =>
                    trackPharmacyEngagement({ pharmacyId: pharmacy.id, eventType: "whatsapp_click", source: "profile" })
                  }
                />
                <ContactChip
                  href={
                    pharmacy.maps_url?.trim() ||
                    (pharmacy.latitude != null && pharmacy.longitude != null
                      ? `https://www.google.com/maps?q=${pharmacy.latitude},${pharmacy.longitude}`
                      : undefined)
                  }
                  label="Itinéraire"
                  disabled={!pharmacy.maps_url?.trim() && (pharmacy.latitude == null || pharmacy.longitude == null)}
                />
                <ContactChip href={pharmacy.email ? `mailto:${pharmacy.email}` : undefined} label="E-mail" disabled={!pharmacy.email} />
                <ContactChip href={pharmacy.website_url ?? undefined} label="Site web" disabled={!pharmacy.website_url} />
                <ContactChip href={pharmacy.facebook_url ?? undefined} label="Facebook" disabled={!pharmacy.facebook_url} />
                <ContactChip href={pharmacy.instagram_url ?? undefined} label="Instagram" disabled={!pharmacy.instagram_url} />
              </div>
            </div>

            {pharmacy.titular_name?.trim() ? (
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {pharmacy.titular_title?.trim() || "Pharmacien titulaire"}
                </h2>
                <p className="mt-1 text-[12px] font-semibold text-foreground">{pharmacy.titular_name.trim()}</p>
              </div>
            ) : null}

            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Services en officine</h2>
              {servicesOffered.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
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
                <p className="mt-1 text-[11px] text-muted-foreground">Liste non renseignée par l&apos;officine.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 border-t border-border bg-muted/15 p-2 sm:hidden">
        <a
          href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
          aria-disabled={!pharmacy.telephone}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-sky-50 py-2.5 text-xs font-semibold text-sky-900 aria-disabled:opacity-40"
        >
          <Phone className="size-4" aria-hidden /> Appeler
        </a>
        <a
          href={wa ? `https://wa.me/${wa}` : undefined}
          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-green-50 py-2.5 text-xs font-semibold text-green-900 aria-disabled:opacity-40"
          aria-disabled={!wa}
        >
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
      </div>
    </article>
  );
}
