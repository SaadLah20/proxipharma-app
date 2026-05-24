"use client";

import type { LucideIcon } from "lucide-react";
import {
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
} from "lucide-react";
import { clsx } from "clsx";

export type PharmacyProfileContactItem = {
  id: string;
  label: string;
  detail?: string;
  href?: string;
  icon: LucideIcon;
  tone: "phone" | "whatsapp" | "maps" | "neutral";
  onClick?: () => void;
};

const TONE_CLASS: Record<PharmacyProfileContactItem["tone"], string> = {
  phone:
    "border-sky-200/90 bg-gradient-to-br from-sky-50 to-sky-100/80 text-sky-950 hover:border-sky-300 hover:shadow-md",
  whatsapp:
    "border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-green-100/70 text-emerald-950 hover:border-emerald-300 hover:shadow-md",
  maps:
    "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white text-teal-950 hover:border-teal-300 hover:shadow-md",
  neutral: "border-border/80 bg-card text-foreground hover:border-primary/25 hover:bg-muted/30 hover:shadow-sm",
};

export function PharmacyProfileContactGrid({ items }: { items: PharmacyProfileContactItem[] }) {
  const available = items.filter((i) => i.href || i.onClick);
  const missing = items.filter((i) => !i.href && !i.onClick);

  if (available.length === 0 && missing.length === items.length) {
    return (
      <p className="rounded-xl border border-dashed border-border/90 bg-muted/10 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Aucun moyen de contact renseigné par l&apos;officine.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {available.map((item) => {
          const Icon = item.icon;
          const cellClass = clsx(
            "flex min-h-[3.25rem] w-full flex-col justify-center gap-1 rounded-lg border px-3 py-2.5 text-left shadow-sm transition hover:shadow-md active:scale-[0.98]",
            TONE_CLASS[item.tone]
          );
          const inner = (
            <>
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/70 shadow-sm ring-1 ring-black/5",
                    item.tone === "phone" && "text-sky-700",
                    item.tone === "whatsapp" && "text-emerald-700",
                    item.tone === "maps" && "text-teal-700",
                    item.tone === "neutral" && "text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 text-[12px] font-bold leading-tight">{item.label}</span>
              </span>
              {item.detail ? (
                <span className="truncate ps-10 text-[10px] font-medium opacity-85">{item.detail}</span>
              ) : null}
            </>
          );
          if (item.href) {
            return (
              <a
                key={item.id}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                onClick={item.onClick}
                className={cellClass}
              >
                {inner}
              </a>
            );
          }
          return (
            <button key={item.id} type="button" onClick={item.onClick} className={cellClass}>
              {inner}
            </button>
          );
        })}
      </div>
      {missing.length > 0 ? (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Non renseigné : {missing.map((m) => m.label.toLowerCase()).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

export const PHARMACY_CONTACT_ICONS = {
  phone: Phone,
  whatsapp: MessageCircle,
  maps: MapPin,
  email: Mail,
  website: Globe,
  facebook: Share2,
  instagram: ExternalLink,
} as const;
