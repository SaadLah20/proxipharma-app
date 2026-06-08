"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

type TotalInput = { sumKnown: number; missingPrice: boolean; empty: boolean };

/** Libellé court total MAD (footer dossier, archives). */
export function useCompactTotalMadLabel() {
  const t = useTranslations("common");

  return useCallback(
    (input: TotalInput): string => {
      if (input.empty) return "—";
      if (input.missingPrice && input.sumKnown === 0) return t("totalDash");
      const amount = input.sumKnown.toFixed(2);
      if (input.missingPrice) return t("totalMadPartial", { amount });
      return t("totalMad", { amount });
    },
    [t],
  );
}

export function useSubtotalBlockMadLabel() {
  const t = useTranslations("common");

  return useCallback(
    (sumKnown: number, missingUnitPrice: boolean): string => {
      if (missingUnitPrice && sumKnown === 0) return t("subtotalBlockMissingPrice");
      const amount = sumKnown.toFixed(2);
      if (missingUnitPrice) return t("subtotalBlockPartial", { amount });
      return t("subtotalBlock", { amount });
    },
    [t],
  );
}

export function useGrandTotalMadLabel() {
  const t = useTranslations("common");

  return useCallback(
    (sumKnown: number, missingUnitPrice: boolean): string => {
      if (missingUnitPrice && sumKnown === 0) return t("totalIncomplete");
      const amount = sumKnown.toFixed(2);
      if (missingUnitPrice) return t("totalMadPartialLong", { amount });
      return t("totalMadLong", { amount });
    },
    [t],
  );
}
