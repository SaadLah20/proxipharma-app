"use client";

import Link from "next/link";
import { ArrowRight, FileText, MessageCircle, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";

const LINKS = [
  {
    hrefSuffix: "demande-produits",
    label: "Demande de produits",
    description: "Recherchez dans le catalogue et envoyez votre liste.",
    icon: ShoppingBag,
    className:
      "border-primary/25 bg-gradient-to-br from-primary/12 via-card to-emerald-50/40 text-foreground hover:border-primary/40",
    iconClass: "text-primary",
    primary: true,
  },
  {
    hrefSuffix: "demande-ordonnance",
    label: "Ordonnance",
    description: "Envoyez une photo ou un PDF de votre ordonnance.",
    icon: FileText,
    className: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-card hover:border-amber-300/90",
    iconClass: "text-amber-800",
    primary: false,
  },
  {
    hrefSuffix: "consultation-libre",
    label: "Consultation libre",
    description: "Posez une question ou décrivez votre besoin.",
    icon: MessageCircle,
    className: "border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-card hover:border-violet-300/90",
    iconClass: "text-violet-800",
    primary: false,
  },
] as const;

export function PharmacyRequestServiceLinks({ pharmacyId }: { pharmacyId: string }) {
  return (
    <div className="space-y-2">
      {LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.hrefSuffix}
            href={`/pharmacie/${pharmacyId}/${item.hrefSuffix}`}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 p-3.5 shadow-sm transition hover:shadow-md",
              item.className,
              item.primary && "ring-1 ring-primary/15"
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card/80 shadow-sm",
                item.iconClass
              )}
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold leading-tight">{item.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{item.description}</span>
            </span>
            <ArrowRight className={cn("size-4 shrink-0 opacity-70", item.iconClass)} aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

export function PharmacyRequestServicesIntro({ className }: { className?: string }) {
  return (
    <div className={cn(pharmacyPublicCard, "border-dashed bg-muted/10 p-3", className)}>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Envoyez une demande à cette officine. Le suivi se fait ensuite dans votre espace personnel — comme depuis
        l&apos;annuaire, sans intermédiaire.
      </p>
    </div>
  );
}
