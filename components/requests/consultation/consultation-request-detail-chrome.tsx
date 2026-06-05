"use client";

import { ConsultationDetailStickyChrome } from "@/components/requests/consultation/consultation-detail-sticky-chrome";
import { ConsultationDetailTabBar } from "@/components/requests/consultation/consultation-detail-tab-bar";
import type { ConsultationDetailTab } from "@/lib/consultation-detail-tabs";
import type { ReactNode } from "react";

/** En-tête dossier (fourni par la page) + onglets Conversation / Produits. */
export function ConsultationRequestDetailChrome({
  header,
  tab,
  onTab,
  conversationUnread = false,
  productLineCount = 0,
}: {
  header: ReactNode;
  tab: ConsultationDetailTab;
  onTab: (t: ConsultationDetailTab) => void;
  conversationUnread?: boolean;
  productLineCount?: number;
}) {
  return (
    <ConsultationDetailStickyChrome>
      {header}
      <ConsultationDetailTabBar
        tab={tab}
        onTab={onTab}
        conversationUnread={conversationUnread}
        productLineCount={productLineCount}
      />
    </ConsultationDetailStickyChrome>
  );
}
