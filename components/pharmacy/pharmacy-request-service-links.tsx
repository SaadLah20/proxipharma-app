"use client";

import Link from "next/link";
import { ArrowRight, FileText, MessageCircle, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";

const LINK_SUFFIXES = ["demande-produits", "demande-ordonnance", "consultation-libre"] as const;
const LINK_ICONS = [ShoppingBag, FileText, MessageCircle] as const;
const LINK_KEYS = ["products", "prescription", "consultation"] as const;
const LINK_STYLES = [
  { iconClass: "text-sky-700", iconBg: "bg-sky-100/90 ring-sky-200/60" },
  { iconClass: "text-amber-800", iconBg: "bg-amber-100/90 ring-amber-200/60" },
  { iconClass: "text-violet-800", iconBg: "bg-violet-100/90 ring-violet-200/60" },
] as const;

export function PharmacyRequestServiceLinks({ pharmacyId }: { pharmacyId: string }) {
  const t = useTranslations("pharmacyPublic");

  return (
    <div className="space-y-2">
      {LINK_SUFFIXES.map((hrefSuffix, i) => {
        const Icon = LINK_ICONS[i];
        const key = LINK_KEYS[i];
        const style = LINK_STYLES[i];
        return (
          <Link
            key={hrefSuffix}
            href={`/pharmacie/${pharmacyId}/${hrefSuffix}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border/90 bg-card p-3.5 shadow-sm transition hover:border-primary/25 hover:shadow-md",
              pharmacyPublicCard
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                style.iconBg,
                style.iconClass
              )}
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold leading-tight">{t(`requestLinks.${key}.label`)}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {t(`requestLinks.${key}.description`)}
              </span>
            </span>
            <ArrowRight className={cn("size-4 shrink-0 opacity-70", style.iconClass)} aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

export function PharmacyRequestServicesIntro({ className }: { className?: string }) {
  const t = useTranslations("pharmacyPublic");
  return (
    <div className={cn(pharmacyPublicCard, "border-dashed bg-muted/10 p-3", className)}>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("servicesIntro")}</p>
    </div>
  );
}
