"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { usePatientDatetimeFormatters } from "@/lib/i18n/use-patient-datetime-formatters";
import type { PatientPharmaAmendmentResumeSection } from "@/lib/patient-pharma-amendment-resume-fr";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

type AmendmentBundle = { created_at: string; amendments: unknown };

function looksTechnicalAmendmentText(text: string): boolean {
  return text.toLowerCase().includes("request_item");
}

function truncateResumeLine(text: string): string {
  return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
}

function splitAmendmentDetailFacts(detail: string): string[] {
  const raw = detail.trim();
  if (!raw) return [];
  const withoutProductPrefix = raw.includes(" — ")
    ? raw.slice(raw.indexOf(" — ") + 3).trim() || raw
    : raw;
  return withoutProductPrefix
    .split(/\s*[·•]\s*|\s+—\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sortedBundles(bundles: AmendmentBundle[]) {
  return [...bundles]
    .filter((b) => b?.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function usePatientPharmaAmendmentCopy() {
  const tResume = useTranslations("demandes.amendmentResume");
  const tSupply = useTranslations("demandes.supplyAmendment");
  const { formatDateTimeShort } = usePatientDatetimeFormatters();

  const channelLabel = useCallback(
    (raw: string | null | undefined): string => {
      if (!raw?.trim()) return "—";
      const slug = raw.trim();
      return tSupply.has(`channels.${slug}`) ? tSupply(`channels.${slug}`) : slug;
    },
    [tSupply],
  );

  const entryFallback = useCallback(
    (kind: string | undefined): string => {
      const k = (kind ?? "").trim();
      return tResume.has(`entryFallback.${k}`) ? tResume(`entryFallback.${k}`) : tResume("entryFallback.default");
    },
    [tResume],
  );

  const lineFromEntry = useCallback(
    (e: SupplyAmendmentEntryJson): string => {
      const summary = (e.summary ?? "").trim();
      const detail = (e.detail ?? "").trim();
      if (summary && !looksTechnicalAmendmentText(summary)) {
        return truncateResumeLine(summary);
      }
      if (detail && !looksTechnicalAmendmentText(detail)) {
        return truncateResumeLine(detail);
      }
      return entryFallback(e.kind);
    },
    [entryFallback],
  );

  const summarizeEntryLines = useCallback(
    (row: SupplyAmendmentEntryJson): string[] => {
      const lines: string[] = [];
      const detail = (row.detail ?? row.summary ?? "").trim();
      const facts =
        detail && !detail.toLowerCase().includes("request_item") ? splitAmendmentDetailFacts(detail) : [];
      if (facts.length > 0) {
        for (const fact of facts) {
          lines.push(fact.length > 200 ? `${fact.slice(0, 197).trim()}…` : fact);
        }
      }
      if (lines.length === 0) {
        const k = (row.kind ?? "").trim();
        lines.push(
          tSupply.has(`facts.${k}`) ? tSupply(`facts.${k}`) : tSupply("facts.default"),
        );
      }
      const ch = row.client_confirmation_channel ? channelLabel(row.client_confirmation_channel) : null;
      const mot = row.client_motive?.trim();
      if (ch) lines.push(tSupply("patientAgreement", { channel: ch }));
      if (mot) lines.push(tSupply("precision", { motive: mot }));
      return lines;
    },
    [channelLabel, tSupply],
  );

  const buildAmendmentResume = useCallback(
    (
      bundles: AmendmentBundle[],
    ): { whenLabel: string; sections: PatientPharmaAmendmentResumeSection[]; batchCount: number } | null => {
      const ordered = sortedBundles(bundles);
      if (ordered.length === 0) return null;

      const buckets: Record<string, string[]> = {
        supply: [],
        added: [],
        withdrawn: [],
      };

      for (const b of ordered) {
        const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
        if (arr.length === 0) continue;
        const when = formatDateTimeShort(b.created_at);
        for (const e of arr) {
          const sec =
            e.kind === "validated_qty_change" || e.kind === "line_adjust_supply"
              ? "supply"
              : e.kind === "line_added_after_confirm"
                ? "added"
                : e.kind === "withdraw_after_confirm" || e.kind === "line_removed_after_confirm"
                  ? "withdrawn"
                  : null;
          if (!sec || !when) continue;
          const text = tResume("lineEntry", { when, detail: lineFromEntry(e) });
          if (!buckets[sec].includes(text)) buckets[sec].push(text);
        }
      }

      const sections: PatientPharmaAmendmentResumeSection[] = [];
      if (buckets.supply.length > 0) {
        sections.push({ id: "supply", title: tResume("sections.supply"), lines: buckets.supply });
      }
      if (buckets.added.length > 0) {
        sections.push({ id: "added", title: tResume("sections.added"), lines: buckets.added });
      }
      if (buckets.withdrawn.length > 0) {
        sections.push({ id: "withdrawn", title: tResume("sections.withdrawn"), lines: buckets.withdrawn });
      }
      if (sections.length === 0) return null;

      const first = ordered[0]!.created_at;
      const last = ordered[ordered.length - 1]!.created_at;
      const whenLabel =
        ordered.length === 1
          ? formatDateTimeShort(last) ?? ""
          : tResume("whenRange", {
              first: formatDateTimeShort(first) ?? "",
              last: formatDateTimeShort(last) ?? "",
              count: ordered.length,
            });

      return { whenLabel, sections, batchCount: ordered.length };
    },
    [formatDateTimeShort, lineFromEntry, tResume],
  );

  const latestSupplyAmendmentNotice = useCallback(
    (
      bundles: AmendmentBundle[],
    ): { whenLabel: string; lines: string[]; earlierBatchCount: number } | null => {
      const ordered = [...bundles]
        .filter((b) => b?.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const b = ordered[0];
      if (!b?.created_at) return null;
      const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
      if (arr.length === 0) return null;
      const lines = arr.flatMap((e) => summarizeEntryLines(e)).filter((s) => s.trim().length > 0);
      if (lines.length === 0) return null;
      return {
        whenLabel: formatDateTimeShort(b.created_at) ?? "",
        lines: lines.slice(0, 4),
        earlierBatchCount: Math.max(0, ordered.length - 1),
      };
    },
    [formatDateTimeShort, summarizeEntryLines],
  );

  return useMemo(
    () => ({
      buildAmendmentResume,
      latestSupplyAmendmentNotice,
    }),
    [buildAmendmentResume, latestSupplyAmendmentNotice],
  );
}
