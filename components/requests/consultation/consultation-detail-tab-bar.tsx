"use client";

import type { ReactNode } from "react";
import { MessageCircle, Package } from "lucide-react";
import { clsx } from "clsx";
import type { ConsultationDetailTab } from "@/lib/consultation-detail-tabs";

export function ConsultationDetailTabBar({
  tab,
  onTab,
  conversationUnread = false,
  productLineCount = 0,
}: {
  tab: ConsultationDetailTab;
  onTab: (t: ConsultationDetailTab) => void;
  conversationUnread?: boolean;
  productLineCount?: number;
}) {
  return (
    <div
      className="flex rounded-xl border-2 border-violet-200/80 bg-gradient-to-r from-violet-50/90 via-white to-fuchsia-50/40 p-1 shadow-sm ring-1 ring-violet-200/50"
      role="tablist"
      aria-label="Consultation libre"
    >
      <TabButton
        active={tab === "conversation"}
        onClick={() => onTab("conversation")}
        icon={<MessageCircle className="size-4 shrink-0" aria-hidden />}
        label="Conversation"
        badge={conversationUnread ? "new" : undefined}
      />
      <TabButton
        active={tab === "products"}
        onClick={() => onTab("products")}
        icon={<Package className="size-4 shrink-0" aria-hidden />}
        label="Produits proposés"
        badge={productLineCount > 0 ? String(productLineCount) : undefined}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm",
        active
          ? "bg-white text-violet-950 shadow-md ring-1 ring-violet-300/60"
          : "text-violet-900/70 hover:bg-white/60 hover:text-violet-950"
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {badge === "new" ? (
        <span
          className="absolute end-2 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-white"
          aria-label="Nouveaux messages"
        />
      ) : badge ? (
        <span className="min-w-[1.125rem] rounded-full bg-violet-700 px-1 py-px text-center text-[9px] font-bold tabular-nums text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
