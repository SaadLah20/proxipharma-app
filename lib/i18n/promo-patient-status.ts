import type { useTranslations } from "next-intl";
import type { PromoReservationStatus } from "@/lib/promo/types";

type PromoT = ReturnType<typeof useTranslations<"promo">>;

export function promoPatientStatusLabel(t: PromoT, status: PromoReservationStatus): string {
  return t(`status.${status}.label`);
}

export function promoPatientStatusHint(
  t: PromoT,
  status: PromoReservationStatus,
  opts?: { pharmacistMessage?: boolean },
): string {
  if (status === "cancelled" && opts?.pharmacistMessage) {
    return t("hintCancelledWithMessage");
  }
  if (status === "confirmed" && opts?.pharmacistMessage) {
    return t("hintConfirmedWithMessage");
  }
  return t(`status.${status}.hint`);
}
