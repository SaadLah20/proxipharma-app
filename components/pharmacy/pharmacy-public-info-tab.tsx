"use client";

import type { LucideIcon } from "lucide-react";
import { MapPin, Stethoscope, UserRound } from "lucide-react";
import {
  PharmacyProfileContactGrid,
  type PharmacyProfileContactItem,
} from "@/components/pharmacy/pharmacy-profile-contact-grid";
import { PharmacyRatingForm } from "@/components/pharmacy/pharmacy-rating-form";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import type { PharmacyPublicProfileRow, PharmacyServiceCatalogRow } from "@/lib/pharmacy-profile-types";
import { cn } from "@/lib/utils";

const PRIMARY_CONTACT_IDS = new Set(["phone", "whatsapp", "maps"]);

function PublicInfoSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(pharmacyPublicCard, "overflow-hidden", className)}>
      <header className="flex items-center gap-2.5 border-b border-border/70 bg-muted/30 px-4 py-3">
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h2>
      </header>
      <div className="space-y-4 bg-card p-4">{children}</div>
    </section>
  );
}

function SecondaryContactLinks({ items }: { items: PharmacyProfileContactItem[] }) {
  const links = items.filter((i) => i.href);
  if (links.length === 0) return null;

  return (
    <div className="border-t border-border/50 pt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Liens</p>
      <ul className="flex flex-wrap gap-1.5">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <a
                href={item.href}
                target={item.href?.startsWith("http") ? "_blank" : undefined}
                rel={item.href?.startsWith("http") ? "noreferrer" : undefined}
                className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/20 px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary/30 hover:bg-muted/40"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PharmacyPublicInfoTab({
  pharmacy,
  contactItems,
  servicesOffered,
  ratingAvg,
  ratingCount,
  onRatingUpdated,
}: {
  pharmacy: PharmacyPublicProfileRow;
  contactItems: PharmacyProfileContactItem[];
  servicesOffered: PharmacyServiceCatalogRow[];
  ratingAvg: number | null;
  ratingCount: number | null;
  onRatingUpdated: (avg: number, count: number) => void;
}) {
  const primaryContacts = contactItems.filter((i) => PRIMARY_CONTACT_IDS.has(i.id));
  const secondaryContacts = contactItems.filter((i) => !PRIMARY_CONTACT_IDS.has(i.id));

  const showTitular =
    pharmacy.titular_public !== false && Boolean(pharmacy.titular_name?.trim());
  const titularTitle = pharmacy.titular_title?.trim() || "Pharmacien titulaire";

  return (
    <div className="space-y-3">
      {pharmacy.welcome_text?.trim() ? (
        <blockquote
          className={cn(
            pharmacyPublicCard,
            "border-l-[3px] border-l-emerald-500/70 bg-gradient-to-br from-emerald-50/40 to-card px-3 py-3 text-[12px] leading-relaxed text-foreground/90"
          )}
        >
          {pharmacy.welcome_text.trim()}
        </blockquote>
      ) : null}

      <PublicInfoSection title="Coordonnées" icon={MapPin}>
        <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Adresse</p>
          <p className="mt-1 text-[12px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
            {pharmacy.adresse}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{pharmacy.ville}</p>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Contact &amp; accès
          </p>
          <PharmacyProfileContactGrid items={primaryContacts} />
        </div>
        <SecondaryContactLinks items={secondaryContacts} />
      </PublicInfoSection>

      <PharmacyRatingForm
        pharmacyId={pharmacy.id}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
        onUpdated={onRatingUpdated}
      />

      {showTitular || servicesOffered.length > 0 ? (
        <PublicInfoSection title="L'officine" icon={Stethoscope}>
          {showTitular ? (
            <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {titularTitle}
              </p>
              <p className="mt-1 flex items-center gap-2 text-[12px] font-semibold text-foreground">
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {pharmacy.titular_name?.trim()}
              </p>
            </div>
          ) : null}

          {servicesOffered.length > 0 ? (
            <div className={cn(showTitular && "pt-1")}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Services proposés
              </p>
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
            </div>
          ) : (
            !showTitular ? (
              <p className="text-[11px] text-muted-foreground">
                Informations complémentaires non renseignées par l&apos;officine.
              </p>
            ) : null
          )}
        </PublicInfoSection>
      ) : null}
    </div>
  );
}
