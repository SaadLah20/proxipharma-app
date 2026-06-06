import type { useTranslations } from "next-intl";
import {
  PATIENT_PROMO_DASHBOARD_BUCKETS_FR,
  type PromoStatBucket,
  type PromoStatBucketKey,
} from "@/lib/promo/reservation-hub-buckets";

type PromoT = ReturnType<typeof useTranslations<"promo">>;

const BUCKET_I18N_KEYS: Record<PromoStatBucketKey, { label: string; hint: string }> = {
  soumise: { label: "dashboard.buckets.soumise.label", hint: "dashboard.buckets.soumise.hint" },
  confirmee: { label: "dashboard.buckets.confirmee.label", hint: "dashboard.buckets.confirmee.hint" },
  recuperee: { label: "dashboard.buckets.recuperee.label", hint: "dashboard.buckets.recuperee.hint" },
  indisponible: { label: "dashboard.buckets.indisponible.label", hint: "dashboard.buckets.indisponible.hint" },
  annulee: { label: "dashboard.buckets.annulee.label", hint: "dashboard.buckets.annulee.hint" },
};

export function patientPromoDashboardBuckets(t: PromoT): PromoStatBucket[] {
  return PATIENT_PROMO_DASHBOARD_BUCKETS_FR.map((b) => {
    const keys = BUCKET_I18N_KEYS[b.key];
    return {
      ...b,
      label: t(keys.label),
      hint: t(keys.hint),
    };
  });
}
