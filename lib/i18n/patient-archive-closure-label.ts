"use client";

import { useTranslations } from "next-intl";
import type { ClosedArchiveLineLike } from "@/lib/patient-closed-archive-line-buckets";

export function usePatientArchiveClosureLabel() {
  const t = useTranslations("demandes.archive.closure");

  return (row: ClosedArchiveLineLike): string => {
    if ((row.counter_outcome ?? "unset") === "picked_up") return t("pickedUp");
    if (row.withdrawn_after_confirm) return t("withdrawn");
    return t("notPickedUp");
  };
}
