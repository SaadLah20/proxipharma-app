import type { RequestKindId } from "@/lib/request-kinds/types";
import { useTranslations } from "next-intl";

const KIND_TO_NS: Record<RequestKindId, "product" | "prescription" | "consultation"> = {
  product_request: "product",
  prescription: "prescription",
  free_consultation: "consultation",
};

export function useRequestKindPatientCopy(requestType: string) {
  const t = useTranslations("workflow");
  const kind = (requestType in KIND_TO_NS ? requestType : "product_request") as RequestKindId;
  const ns = KIND_TO_NS[kind];
  return {
    label: t(`${ns}.label`),
    patientHubTitle: t(`${ns}.patientHubTitle`),
    patientProposedBadge: t.has(`${ns}.patientProposedBadge`) ? t(`${ns}.patientProposedBadge`) : "",
    patientArchiveEmptyLines: t(`${ns}.patientArchiveEmptyLines`),
    patientArchiveClosedFooter: t(`${ns}.patientArchiveClosedFooter`),
    patientSuiviProposedHint: t.has(`${ns}.patientSuiviProposedHint`) ? t(`${ns}.patientSuiviProposedHint`) : "",
    patientSummaryKindLabel: t(`${ns}.patientSummaryKindLabel`),
    patientSummaryRefShort: t(`${ns}.patientSummaryRefShort`),
    patientProductsSectionTitle: t(`${ns}.patientProductsSectionTitle`),
    patientWaitingSubmittedHint: t(`${ns}.patientWaitingSubmittedHint`),
    patientWaitingInReviewHint: t(`${ns}.patientWaitingInReviewHint`),
    patientCancelWhileWaitingLabel: t(`${ns}.patientCancelWhileWaitingLabel`),
    patientLineOriginLabel:
      ns === "prescription" ? t("prescription.patientLineOriginLabel") : undefined,
  };
}

export function patientDashboardBucketLabels(
  t: ReturnType<typeof useTranslations<"hub">>,
  kindId: RequestKindId,
): Record<string, { label: string; hint: string }> {
  const hints =
    kindId === "prescription"
      ? {
          envoyees: t("prescriptionHints.envoyees"),
          repondues: t("prescriptionHints.repondues"),
          validees_traitees: t("prescriptionHints.validees_traitees"),
          traitee_retrait: t("prescriptionHints.traitee_retrait"),
          cloturees: t("prescriptionHints.cloturees"),
          abandonnees: t("prescriptionHints.abandonnees"),
          expirees: t("prescriptionHints.expirees"),
          annulees: t("prescriptionHints.annulees"),
        }
      : kindId === "free_consultation"
        ? {
            envoyees: t("consultationHints.envoyees"),
            repondues: t("consultationHints.repondues"),
            validees_traitees: t("consultationHints.validees_traitees"),
            traitee_retrait: t("consultationHints.traitee_retrait"),
            cloturees: t("consultationHints.cloturees"),
            abandonnees: t("consultationHints.abandonnees"),
            expirees: t("consultationHints.expirees"),
            annulees: t("consultationHints.annulees"),
          }
        : null;

  const keys = [
    "envoyees",
    "repondues",
    "validees_traitees",
    "traitee_retrait",
    "cloturees",
    "abandonnees",
    "expirees",
    "annulees",
  ] as const;

  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        label: t(`buckets.${key}.label`),
        hint: hints?.[key] ?? t(`buckets.${key}.hint`),
      },
    ]),
  );
}
