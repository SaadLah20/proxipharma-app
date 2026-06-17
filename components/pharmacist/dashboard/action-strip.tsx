"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { AlertCircle, ClipboardList, MessageSquare, UserCheck } from "lucide-react";
import type { PharmacistDashboardSnapshot } from "@/lib/pharmacist-dashboard";

const DEMANDES_HUB = "/dashboard/pharmacien/demandes";

type ActionTile = {
  key: string;
  label: string;
  hint: string;
  value: number;
  href: string;
  icon: typeof AlertCircle;
  tone: "amber" | "sky" | "emerald" | "violet";
};

function toneClass(tone: ActionTile["tone"], active: boolean) {
  if (!active) return "border-border/80 bg-card text-muted-foreground";
  if (tone === "amber") return "border-amber-300/80 bg-amber-50/70 text-amber-950";
  if (tone === "emerald") return "border-emerald-300/80 bg-emerald-50/70 text-emerald-950";
  if (tone === "violet") return "border-violet-300/80 bg-violet-50/70 text-violet-950";
  return "border-sky-300/80 bg-sky-50/70 text-sky-950";
}

export function PharmacistDashboardActionStrip({ snapshot }: { snapshot: PharmacistDashboardSnapshot }) {
  const tiles: ActionTile[] = [
    {
      key: "needs_action",
      label: "À traiter",
      hint: "Envoyées ou validées client",
      value: snapshot.requests.needs_action,
      href: DEMANDES_HUB,
      icon: AlertCircle,
      tone: "amber",
    },
    {
      key: "unread",
      label: "Messages",
      hint: "Conversations non lues",
      value: snapshot.messages.unread_conversations,
      href: "/dashboard/notifications?onglet=messages",
      icon: MessageSquare,
      tone: "sky",
    },
    {
      key: "pickup",
      label: "Comptoir",
      hint: "Retraits en attente",
      value: snapshot.requests.awaiting_pickup,
      href: `${DEMANDES_HUB}?vue=liste&statut=traitee_retrait`,
      icon: ClipboardList,
      tone: "emerald",
    },
    {
      key: "responded",
      label: "Attente client",
      hint: "Validation sous 24 h",
      value: snapshot.requests.responded_pending,
      href: `${DEMANDES_HUB}?vue=liste&statut=repondues`,
      icon: UserCheck,
      tone: "violet",
    },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const active = tile.value > 0;
        const Icon = tile.icon;
        return (
          <Link
            key={tile.key}
            href={tile.href}
            className={clsx(
              "flex items-center gap-3 rounded-xl border p-3 shadow-sm transition hover:shadow-md",
              toneClass(tile.tone, active)
            )}
          >
            <div className="rounded-lg bg-background/70 p-2 shadow-inner">
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{tile.label}</p>
              <p className="text-2xl font-bold tabular-nums leading-none">{tile.value}</p>
              <p className="mt-0.5 truncate text-[11px] opacity-75">{tile.hint}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
