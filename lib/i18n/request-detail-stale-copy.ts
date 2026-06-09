import type { useTranslations } from "next-intl";
import type { RequestStaleScenario, RequestStaleState } from "@/lib/request-detail-stale";

type DriftT = ReturnType<typeof useTranslations<"demandes.drift">>;

const SCENARIO_TITLE_KEYS: Record<RequestStaleScenario, string> = {
  pharmacien_confirmed_to_treated: "pharmacienConfirmedToTreatedTitle",
  patient_confirmed_to_treated: "patientConfirmedToTreatedTitle",
  pharmacien_submitted_updated: "pharmacienSubmittedUpdatedTitle",
  pharmacien_responded_stale: "pharmacienRespondedStaleTitle",
  pharmacien_confirmed_updated: "pharmacienConfirmedUpdatedTitle",
  patient_submitted_stale: "patientSubmittedStaleTitle",
  patient_responded_updated: "patientRespondedUpdatedTitle",
  patient_confirmed_updated: "patientConfirmedUpdatedTitle",
  generic: "genericTitle",
};

const SCENARIO_MESSAGE_KEYS: Record<RequestStaleScenario, string> = {
  pharmacien_confirmed_to_treated: "pharmacienConfirmedToTreatedMessage",
  patient_confirmed_to_treated: "patientConfirmedToTreatedMessage",
  pharmacien_submitted_updated: "pharmacienSubmittedUpdatedMessage",
  pharmacien_responded_stale: "pharmacienRespondedStaleMessage",
  pharmacien_confirmed_updated: "pharmacienConfirmedUpdatedMessage",
  patient_submitted_stale: "patientSubmittedStaleMessage",
  patient_responded_updated: "patientRespondedUpdatedMessage",
  patient_confirmed_updated: "patientConfirmedUpdatedMessage",
  generic: "genericMessage",
};

export function requestDetailStaleTitle(t: DriftT, stale: RequestStaleState): string {
  return t(SCENARIO_TITLE_KEYS[stale.scenario] as Parameters<typeof t>[0]);
}

export function requestDetailStaleMessage(t: DriftT, stale: RequestStaleState): string {
  return t(SCENARIO_MESSAGE_KEYS[stale.scenario] as Parameters<typeof t>[0]);
}
