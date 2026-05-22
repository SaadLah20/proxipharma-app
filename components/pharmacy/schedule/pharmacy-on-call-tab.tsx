"use client";

import { useMemo, useState } from "react";
import { ON_CALL_KIND_LABEL_FR } from "@/lib/pharmacy-schedule-fr";
import {
  computeOnCallPeriod,
  formatOnCallEndLabel,
  ON_CALL_DEFAULT_START_TIME,
} from "@/lib/pharmacy-on-call-compute";
import { overridesOnOnCallDates } from "@/lib/pharmacy-schedule-conflicts";
import { ScheduleConfirmDialog } from "@/components/pharmacy/schedule/schedule-confirm-dialog";
import type { PharmacyDayOverrideRow, PharmacyOnCallKind, PharmacyOnCallPeriodRow } from "@/lib/pharmacy-profile-types";

function formatOverrideDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function PharmacyOnCallTab({
  todayIso,
  onCallList,
  overrideList,
  busy,
  onPlan,
  onDelete,
  onHint,
}: {
  todayIso: string;
  onCallList: PharmacyOnCallPeriodRow[];
  overrideList: PharmacyDayOverrideRow[];
  busy: boolean;
  onPlan: (payload: {
    kind: PharmacyOnCallKind;
    starts_at: string;
    ends_at: string;
    note: string | null;
    overrideIdsToRemove: string[];
  }) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<void>;
  onHint: (message: string, tone?: "info" | "warning" | "error" | "success") => void;
}) {
  const [onCallKind, setOnCallKind] = useState<PharmacyOnCallKind>("weekday_24h");
  const [onCallStartDate, setOnCallStartDate] = useState("");
  const [onCallNote, setOnCallNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const computed = useMemo(() => {
    if (!onCallStartDate) return null;
    return computeOnCallPeriod(onCallKind, onCallStartDate);
  }, [onCallKind, onCallStartDate]);

  const conflictingOverrides = useMemo(() => {
    if (!computed) return [];
    return overridesOnOnCallDates(overrideList, computed.startsAtIso, computed.endsAtIso);
  }, [computed, overrideList]);

  const requestPlan = () => {
    if (!onCallStartDate) {
      onHint("Choisissez le jour de début de la garde.", "warning");
      return;
    }
    if (onCallStartDate < todayIso) {
      onHint("Impossible de planifier une garde dans le passé.", "error");
      return;
    }
    if (!computed) return;

    if (conflictingOverrides.length > 0) {
      setConfirmOpen(true);
      return;
    }
    void executePlan();
  };

  const executePlan = async () => {
    if (!computed) return;
    setConfirmOpen(false);
    const { error } = await onPlan({
      kind: onCallKind,
      starts_at: computed.startsAtIso,
      ends_at: computed.endsAtIso,
      note: onCallNote.trim() || null,
      overrideIdsToRemove: conflictingOverrides.map((o) => o.id),
    });
    if (!error) {
      setOnCallStartDate("");
      setOnCallNote("");
      onHint("Garde planifiée.", "success");
    } else {
      onHint(error, "error");
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
        Saisissez le <strong>type</strong> et le <strong>jour de début</strong> (début à {ON_CALL_DEFAULT_START_TIME.replace(":", "h")}).
        La fin est calculée automatiquement. Ex. garde 24 h du mercredi : jeudi affiche « Garde jusqu&apos;à 9h » puis vos
        horaires habituels du jeudi.
      </p>

      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <label className="block text-xs font-bold">
          Type de garde
          <select
            className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
            value={onCallKind}
            onChange={(e) => {
              setOnCallKind(e.target.value as PharmacyOnCallKind);
              onHint(
                e.target.value === "weekend_48h"
                  ? "Garde de 48 h : fin automatique 2 jours après le début, à 9h."
                  : "Garde de 24 h : fin automatique le lendemain à 9h.",
                "info"
              );
            }}
          >
            {Object.entries(ON_CALL_KIND_LABEL_FR).map(([k, lab]) => (
              <option key={k} value={k}>
                {lab}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-bold">
          Jour de début
          <input
            type="date"
            min={todayIso}
            className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
            value={onCallStartDate}
            onChange={(e) => setOnCallStartDate(e.target.value)}
          />
        </label>

        {computed ? (
          <div className="rounded-lg bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Fin (automatique, non modifiable)</p>
            <p className="mt-1">{formatOnCallEndLabel(onCallKind, computed.endDateIso)}</p>
          </div>
        ) : null}

        <label className="block text-xs font-bold">
          Note (optionnel)
          <input
            className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
            value={onCallNote}
            maxLength={120}
            placeholder="Ex. Quartier X"
            onChange={(e) => setOnCallNote(e.target.value)}
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy || !onCallStartDate}
        onClick={requestPlan}
        className="w-full rounded-xl bg-amber-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
      >
        Planifier la garde
      </button>

      {onCallList.length > 0 ? (
        <ul className="space-y-2">
          {onCallList.map((p) => (
            <li
              key={p.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-amber-200/60 bg-amber-50/40 p-3 text-xs"
            >
              <div>
                <p className="font-bold text-amber-950">{ON_CALL_KIND_LABEL_FR[p.kind] ?? p.kind}</p>
                <p className="text-amber-900/80">
                  {new Date(p.starts_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} →{" "}
                  {new Date(p.ends_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </p>
                {p.note ? <p className="mt-0.5">{p.note}</p> : null}
              </div>
              <button
                type="button"
                className="shrink-0 font-semibold text-destructive underline"
                disabled={busy}
                onClick={() => void onDelete(p.id)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted-foreground">Aucune garde planifiée.</p>
      )}

      <ScheduleConfirmDialog
        open={confirmOpen}
        title="Remplacer des exceptions ?"
        confirmLabel="Oui, planifier la garde"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void executePlan()}
      >
        <p>
          Ce jour (ou cette période) a déjà une ou plusieurs exceptions. Si vous continuez, elles seront{" "}
          <strong>supprimées</strong> et remplacées par la garde :
        </p>
        <ul className="mt-2 list-inside list-disc text-foreground">
          {conflictingOverrides.map((o) => (
            <li key={o.id}>
              {formatOverrideDate(o.day_date)} — {o.label ?? o.override_type}
            </li>
          ))}
        </ul>
      </ScheduleConfirmDialog>
    </div>
  );
}
