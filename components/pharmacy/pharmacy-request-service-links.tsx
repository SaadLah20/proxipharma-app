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
    iconClass: "text-sky-700",
    iconBg: "bg-sky-100/90 ring-sky-200/60",
  },
  {
    hrefSuffix: "demande-ordonnance",
    label: "Ordonnance",
    description: "Envoyez une photo ou un PDF de votre ordonnance.",
    icon: FileText,
    iconClass: "text-amber-800",
    iconBg: "bg-amber-100/90 ring-amber-200/60",
  },
  {
    hrefSuffix: "consultation-libre",
    label: "Consultation libre",
    description: "Posez une question ou décrivez votre besoin.",
    icon: MessageCircle,
    iconClass: "text-violet-800",
    iconBg: "bg-violet-100/90 ring-violet-200/60",
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
              "flex items-center gap-3 rounded-xl border border-border/90 bg-card p-3.5 shadow-sm transition hover:border-primary/25 hover:shadow-md",
              pharmacyPublicCard
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                item.iconBg,
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
        Envoyez une demande à cette officine. Le suivi se fait ensuite dans votre espace personnel.
      </p>
    </div>
  );
}
