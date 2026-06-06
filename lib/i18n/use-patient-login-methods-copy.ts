"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import type { PatientLoginMethods } from "@/lib/patient-auth-login-methods-fr";

export function usePatientLoginMethodsCopy() {
  const t = useTranslations("account.loginMethods");

  const summary = useCallback(
    (m: PatientLoginMethods): string => {
      if (m.canLoginWithEmail && m.canLoginWithPhone) {
        return t("summaryEmailAndPhone");
      }
      if (m.canLoginWithEmail) {
        return t("summaryEmailOnly");
      }
      if (m.canLoginWithPhone) {
        return t("summaryPhoneOnly");
      }
      return t("summaryIncomplete");
    },
    [t],
  );

  const identifiers = useCallback(
    (m: PatientLoginMethods): string[] => {
      const lines: string[] = [];
      if (m.canLoginWithPhone && m.authPhoneE164) {
        lines.push(t("phoneLine", { phone: m.authPhoneE164 }));
      } else if (m.profileWhatsapp && m.needsPhoneAuthSync) {
        lines.push(t("phoneProfilePending", { phone: m.profileWhatsapp }));
      }
      if (m.canLoginWithEmail && m.authEmail) {
        lines.push(t("emailLine", { email: m.authEmail }));
      }
      return lines;
    },
    [t],
  );

  return { summary, identifiers };
}
