"use client";

import { ConsultationDetailStickyChrome } from "@/components/requests/consultation/consultation-detail-sticky-chrome";
import { ConsultationDetailTabBar } from "@/components/requests/consultation/consultation-detail-tab-bar";
import type { ConsultationDetailTab } from "@/lib/consultation-detail-tabs";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
import { requestStatusFr } from "@/lib/request-display";
import { clsx } from "clsx";

/** En-tête consultation minimal (réf. + statut) + onglets Conversation / Produits. */
export function ConsultationRequestDetailChrome({
  dossierRefLabel,
  status,
  tab,
  onTab,
  conversationUnread = false,
  productLineCount = 0,
  submittedAt,
  createdAt,
}: {
  dossierRefLabel: string;
  status: string;
  tab: ConsultationDetailTab;
  onTab: (t: ConsultationDetailTab) => void;
  conversationUnread?: boolean;
  productLineCount?: number;
  submittedAt?: string | null;
  createdAt?: string | null;
}) {
  const statusLabel = requestStatusFr[status] ?? status;
  return (
    <ConsultationDetailStickyChrome>
      <div className="rounded-lg border border-violet-200/75 bg-white/95 px-2.5 py-2 shadow-sm ring-1 ring-violet-200/45">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <DossierHeaderRequestLine
            kindLabel="Consultation"
            dossierRefLabel={dossierRefLabel}
            submittedAt={submittedAt}
            createdAt={createdAt}
            className="min-w-0 flex-1 text-[10px] sm:text-[11px]"
          />
          <span
            className={clsx(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              ["submitted", "in_review"].includes(status) && "border-violet-300/90 bg-violet-100 text-violet-950",
              status === "responded" && "border-amber-300/90 bg-amber-50 text-amber-950",
              ["confirmed", "treated", "completed"].includes(status) &&
                "border-teal-300/85 bg-teal-50 text-teal-950"
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <ConsultationDetailTabBar
        tab={tab}
        onTab={onTab}
        conversationUnread={conversationUnread}
        productLineCount={productLineCount}
      />
    </ConsultationDetailStickyChrome>
  );
}
