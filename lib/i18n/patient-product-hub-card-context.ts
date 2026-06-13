"use client";

import { useLocale, useTranslations } from "next-intl";
import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import {
  type PatientProductHubCardContext,
  patientProductHubCardContextFr,
} from "@/lib/patient-product-hub-sections";
import {
  summarizeRequestForPatientCard,
  type PatientRequestItemRow,
} from "@/lib/patient-request-list-summary";
import { shouldShowCatalogPricesToPatient } from "@/lib/pharmacy-pricing/catalog-price-visibility";
import { usePharmacyCatalogPriceShowFlag } from "@/lib/patient-hub-catalog-price-visibility-context";

function itemsOf(row: PatientRequestRow): PatientRequestItemRow[] {
  const raw = row.request_items;
  return (Array.isArray(raw) ? raw : []) as PatientRequestItemRow[];
}

/** Carte hub patient — contexte i18n (FR par défaut via fallback legacy). */
export function usePatientProductHubCardContext(row: PatientRequestRow): PatientProductHubCardContext {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("hub.cardContext");
  const pharmacyShowFlag = usePharmacyCatalogPriceShowFlag(row.pharmacy_id);
  const showCatalogPricesToPatient = shouldShowCatalogPricesToPatient(pharmacyShowFlag, row.status);
  const items = itemsOf(row);
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status, {
    showCatalogPricesToPatient,
  });
  const n = summary.lineCount;
  const retained =
    summary.selectedPrincipalCount + summary.selectedProposedCount + summary.selectedAlternativesCount;
  const when = formatDateTimeShortForLocale(row.updated_at ?? row.submitted_at ?? row.created_at, locale);

  switch (row.status) {
    case "responded": {
      const total =
        summary.totalSelectedDh != null
          ? t("respondedTotalIfAll", { amount: summary.totalSelectedDh.toFixed(2) })
          : "";
      return {
        primaryLine: t("respondedPrimary", { count: n }),
        secondaryLine: t("respondedSecondary", { total }),
        emphasis: "urgent",
      };
    }
    case "treated": {
      const wait = summary.selectedPendingPickupCount;
      return {
        primaryLine:
          wait > 0 ? t("treatedWaitingPrimary", { count: wait }) : t("treatedRetainedPrimary", { count: retained }),
        secondaryLine: t("treatedSecondary"),
        emphasis: "info",
      };
    }
    case "submitted":
    case "in_review":
      if (row.request_type === "prescription") {
        return {
          primaryLine: n > 0 ? t("prescriptionEnteredPrimary", { count: n }) : t("prescriptionScanPrimary"),
          secondaryLine: n > 0 ? t("prescriptionPrepSecondary") : t("prescriptionScanSecondary"),
          emphasis: "info",
        };
      }
      return {
        primaryLine: t("submittedPrimary", { count: n }),
        secondaryLine:
          summary.totalInitialDh != null
            ? t("submittedSecondaryWithEstimate", { amount: summary.totalInitialDh.toFixed(2) })
            : t("submittedSecondary"),
        emphasis: "info",
      };
    case "confirmed": {
      const parts: string[] = [];
      if (summary.hasExecutionProgress) {
        if (summary.selectedToOrderPendingCount > 0) {
          parts.push(t("confirmedToOrder", { count: summary.selectedToOrderPendingCount }));
        }
        const reserved = retained - summary.selectedToOrderPendingCount;
        if (reserved > 0) parts.push(t("confirmedToReserve", { count: reserved }));
      }
      return {
        primaryLine: t("confirmedPrimary", { count: retained }),
        secondaryLine:
          parts.length > 0 ? t("confirmedPrepSecondary", { parts: parts.join(" · ") }) : t("confirmedSecondary"),
        emphasis: "info",
      };
    }
    case "completed":
    case "partially_collected":
    case "fully_collected": {
      const picked = summary.selectedPickedUpCount;
      return {
        primaryLine: t("closedPrimary", { picked, retained }),
        secondaryLine: t("closedSecondary", { when }),
        emphasis: "success",
      };
    }
    case "expired":
      return {
        primaryLine: t("expiredPrimary"),
        secondaryLine: t("expiredSecondary", { count: n }),
        emphasis: "muted",
      };
    case "abandoned":
      return {
        primaryLine: t("abandonedPrimary"),
        secondaryLine: t("archivedSecondary", { when }),
        emphasis: "muted",
      };
    case "cancelled":
      return {
        primaryLine: t("cancelledPrimary"),
        secondaryLine: t("archivedSecondary", { when }),
        emphasis: "muted",
      };
    default:
      return patientProductHubCardContextFr(row, { showCatalogPricesToPatient });
  }
}
