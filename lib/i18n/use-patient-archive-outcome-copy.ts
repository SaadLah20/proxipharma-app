"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePatientDatetimeFormatters } from "@/lib/i18n/use-patient-datetime-formatters";
import type {
  ArchiveHistoryRow,
  PatientProductClosedArchiveStatus,
} from "@/lib/patient-archive-outcome-fr";
import { patientDossierHistoryDetailParagraphsFr } from "@/lib/patient-request-history-audit";
import { historyActorToneFromReason } from "@/lib/request-history-fr";
import type { RequestKindId } from "@/lib/request-kinds/types";

type ClosedRecapItem = {
  is_selected_by_patient: boolean;
  counter_outcome?: string | null;
};

type TerminalArchiveStatus =
  | "cancelled"
  | "abandoned"
  | "expired"
  | "completed"
  | "partially_collected"
  | "fully_collected";

export function usePatientArchiveOutcomeCopy() {
  const t = useTranslations("demandes.archive.terminal");
  const tActors = useTranslations("timeline-events.actors");
  const { formatDateTimeShort } = usePatientDatetimeFormatters();

  const patientHistoryActorLabel = useCallback(
    (reason: string | null | undefined): string => {
      const tone = historyActorToneFromReason(reason, "patient");
      if (tone === "patient") return tActors("you");
      if (tone === "pharmacy") return tActors("pharmacy");
      return tActors("system");
    },
    [tActors],
  );

  const terminalActorLine = useCallback(
    (entry: ArchiveHistoryRow | null): string | null => {
      if (!entry) return null;
      const who = patientHistoryActorLabel(entry.reason);
      const when = formatDateTimeShort(entry.created_at);
      if (!when) return who;
      return `${who} · ${when}`;
    },
    [patientHistoryActorLabel, formatDateTimeShort],
  );

  const motiveSuffix = useCallback(
    (entry: ArchiveHistoryRow | null): string => {
      if (!entry?.reason?.trim()) return "";
      const paras = patientDossierHistoryDetailParagraphsFr(entry.reason);
      if (paras.length === 0) return "";
      return t("motivePrefix", { motive: paras.join(" ") });
    },
    [t],
  );

  const terminalDetailWithActor = useCallback(
    (
      entry: ArchiveHistoryRow | null,
      keys: {
        withActor: string;
        withMotive: string;
        default: string;
      },
    ): string => {
      const actorLine = terminalActorLine(entry);
      const motive = motiveSuffix(entry);
      if (actorLine) {
        return t(keys.withActor, { actor: actorLine, motive });
      }
      if (motive.trim()) {
        return t(keys.withMotive, { motive });
      }
      return t(keys.default);
    },
    [terminalActorLine, motiveSuffix, t],
  );

  const expiredHintShort = useCallback(() => t("expired.short"), [t]);

  const expiredHintDetail = useCallback(
    (input: {
      expiredAt?: string | null;
      expiresAt?: string | null;
      respondedAt?: string | null;
    }): string => {
      const when = formatDateTimeShort(
        input.expiredAt?.trim() || input.expiresAt?.trim() || input.respondedAt?.trim() || "",
      );
      return when ? t("expired.detailWithDate", { when }) : t("expired.detailNoDate");
    },
    [formatDateTimeShort, t],
  );

  const cancelledHintShort = useCallback(() => t("cancelled.short"), [t]);

  const cancelledHintDetail = useCallback(
    (entry: ArchiveHistoryRow | null): string =>
      terminalDetailWithActor(entry, {
        withActor: "cancelled.detailWithActor",
        withMotive: "cancelled.detailWithMotive",
        default: "cancelled.detailDefault",
      }),
    [terminalDetailWithActor],
  );

  const cancelledPrescriptionEmptyDetail = useCallback(
    (entry: ArchiveHistoryRow | null): string =>
      terminalDetailWithActor(entry, {
        withActor: "cancelled.prescriptionEmptyWithActor",
        withMotive: "cancelled.prescriptionEmptyWithMotive",
        default: "cancelled.prescriptionEmptyDefault",
      }),
    [terminalDetailWithActor],
  );

  const abandonedHintShort = useCallback(() => t("abandoned.short"), [t]);

  const abandonedHintDetail = useCallback(
    (entry: ArchiveHistoryRow | null): string =>
      terminalDetailWithActor(entry, {
        withActor: "abandoned.detailWithActor",
        withMotive: "abandoned.detailWithMotive",
        default: "abandoned.detailDefault",
      }),
    [terminalDetailWithActor],
  );

  const abandonedPrescriptionEmptyDetail = useCallback(
    (entry: ArchiveHistoryRow | null): string =>
      terminalDetailWithActor(entry, {
        withActor: "abandoned.prescriptionEmptyWithActor",
        withMotive: "abandoned.prescriptionEmptyWithMotive",
        default: "abandoned.prescriptionEmptyDefault",
      }),
    [terminalDetailWithActor],
  );

  const closedHintShort = useCallback(
    (input: {
      terminalStatus: PatientProductClosedArchiveStatus;
      items: ClosedRecapItem[];
    }): string => {
      const retainedCount = input.items.filter((r) => r.is_selected_by_patient).length;
      const pickedUpCount = input.items.filter(
        (r) => r.is_selected_by_patient && (r.counter_outcome ?? "unset") === "picked_up",
      ).length;
      if (input.terminalStatus === "fully_collected") {
        return t("closed.shortFullyCollected");
      }
      if (input.terminalStatus === "partially_collected") {
        return pickedUpCount === 1
          ? t("closed.shortPartialOne", { picked: pickedUpCount, retained: retainedCount })
          : t("closed.shortPartialMany", { picked: pickedUpCount, retained: retainedCount });
      }
      return t("closed.shortDefault");
    },
    [t],
  );

  const closedHintDetail = useCallback(
    (input: {
      terminalStatus: PatientProductClosedArchiveStatus;
      items: ClosedRecapItem[];
      historyEntry?: ArchiveHistoryRow | null;
    }): string => {
      const { terminalStatus, items, historyEntry } = input;
      const totalLines = items.length;
      const retainedCount = items.filter((r) => r.is_selected_by_patient).length;
      const pickedUpCount = items.filter(
        (r) => r.is_selected_by_patient && (r.counter_outcome ?? "unset") === "picked_up",
      ).length;
      const closedAt = historyEntry ? formatDateTimeShort(historyEntry.created_at) : "";

      const recap: string[] = [
        pickedUpCount === 1
          ? t("closed.recapPickedUpOne", { picked: pickedUpCount, retained: retainedCount })
          : t("closed.recapPickedUpMany", { picked: pickedUpCount, retained: retainedCount }),
      ];
      if (totalLines !== retainedCount) {
        recap.push(
          totalLines === 1
            ? t("closed.recapTotalLinesOne", { total: totalLines })
            : t("closed.recapTotalLinesMany", { total: totalLines }),
        );
      }
      if (closedAt) recap.push(t("closed.recapClosedAt", { when: closedAt }));

      const head = t("closed.head", { recap: recap.join(" · ") });
      if (terminalStatus === "fully_collected") {
        return `${head} ${t("closed.tailFullyCollected")}`;
      }
      if (terminalStatus === "partially_collected") {
        return `${head} ${t("closed.tailPartiallyCollected")}`;
      }
      return head;
    },
    [formatDateTimeShort, t],
  );

  const expiredOutcomeHint = useCallback(
    (kindId: RequestKindId): string | null => {
      if (kindId === "prescription") return t("expired.hintPrescription");
      return t("expired.hintProduct");
    },
    [t],
  );

  const statusFooter = useCallback(
    (
      status: TerminalArchiveStatus,
      kindId: RequestKindId,
      closedFooterNote?: string | null,
    ): string => {
      const ord = kindId === "prescription";
      switch (status) {
        case "cancelled":
          return ord ? t("statusFooter.cancelledPrescription") : t("statusFooter.cancelledDefault");
        case "abandoned":
          return ord ? t("statusFooter.abandonedPrescription") : t("statusFooter.abandonedDefault");
        case "expired":
          return ord ? t("statusFooter.expiredPrescription") : t("statusFooter.expiredDefault");
        case "partially_collected":
          return ord
            ? t("statusFooter.partiallyCollectedPrescription")
            : t("statusFooter.partiallyCollectedDefault");
        case "fully_collected":
          return t("statusFooter.fullyCollected");
        case "completed":
        default:
          return (
            closedFooterNote ??
            (ord ? t("statusFooter.completedPrescription") : t("statusFooter.completedDefault"))
          );
      }
    },
    [t],
  );

  return useMemo(
    () => ({
      patientHistoryActorLabel,
      terminalActorLine,
      expiredHintShort,
      expiredHintDetail,
      cancelledHintShort,
      cancelledHintDetail,
      cancelledPrescriptionEmptyDetail,
      abandonedHintShort,
      abandonedHintDetail,
      abandonedPrescriptionEmptyDetail,
      closedHintShort,
      closedHintDetail,
      expiredOutcomeHint,
      statusFooter,
    }),
    [
      patientHistoryActorLabel,
      terminalActorLine,
      expiredHintShort,
      expiredHintDetail,
      cancelledHintShort,
      cancelledHintDetail,
      cancelledPrescriptionEmptyDetail,
      abandonedHintShort,
      abandonedHintDetail,
      abandonedPrescriptionEmptyDetail,
      closedHintShort,
      closedHintDetail,
      expiredOutcomeHint,
      statusFooter,
    ],
  );
}
