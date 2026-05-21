"use client";

import {
  effectiveAvailabilityForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";

export type RequestLineSuiviStripRow = Pick<
  PatientLineLike,
  | "is_selected_by_patient"
  | "withdrawn_after_confirm"
  | "availability_status"
  | "available_qty"
  | "patient_chosen_alternative_id"
  | "request_item_alternatives"
  | "post_confirm_fulfillment"
  | "counter_outcome"
>;

function suiviChip(label: string, variant: "done" | "current" | "todo") {
  const base =
    "inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide leading-tight";
  if (variant === "done") {
    return (
      <span className={`${base} border-emerald-400/80 bg-emerald-100/90 text-emerald-950`} aria-current="false">
        {label}
      </span>
    );
  }
  if (variant === "current") {
    return (
      <span
        className={`${base} border-primary/50 bg-primary/12 text-primary ring-1 ring-primary/25`}
        aria-current="step"
      >
        {label}
      </span>
    );
  }
  return (
    <span className={`${base} border-border/70 bg-muted/25 text-muted-foreground`} aria-current="false">
      {label}
    </span>
  );
}

const suiviSep = <span className="text-[9px] font-semibold text-muted-foreground/80" aria-hidden>→</span>;

/** Jalons réservation / commande / comptoir (dossier traité — remplace les pastilles à côté de la dispo). */
export function RequestLineSuiviStrip({ row }: { row: RequestLineSuiviStripRow }) {
  if (!row.is_selected_by_patient || row.withdrawn_after_confirm) return null;
  const eff = effectiveAvailabilityForPatientLine(row as PatientLineLike);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  const picked = (row.counter_outcome ?? "unset") === "picked_up";

  if (eff === "available" || eff === "partially_available") {
    const reserved = pcf === "reserved";
    const s0 = reserved ? "done" : "current";
    const s1 = picked ? "done" : reserved ? "current" : "todo";
    const s2 = picked ? "done" : "todo";
    return (
      <div className="space-y-1">
        <p className="text-[8px] font-bold uppercase tracking-wide text-slate-700">Suivi</p>
        <div className="flex flex-wrap items-center gap-1">
          {suiviChip("Réservé", s0)}
          {suiviSep}
          {suiviChip("En attente de passage", s1)}
          {suiviSep}
          {suiviChip("Récupéré", s2)}
        </div>
      </div>
    );
  }

  if (eff === "to_order") {
    const arrived = pcf === "arrived_reserved";
    const ordered = pcf === "ordered" || arrived;
    const sCmd = ordered ? "done" : "current";
    const sRecv = arrived ? "done" : ordered ? "current" : "todo";
    const sPass = picked ? "done" : arrived ? "current" : "todo";
    const sPick = picked ? "done" : "todo";
    return (
      <div className="space-y-1">
        <p className="text-[8px] font-bold uppercase tracking-wide text-slate-700">Suivi</p>
        <div className="flex flex-wrap items-center gap-1">
          {suiviChip("Commandé", sCmd)}
          {suiviSep}
          {suiviChip("Reçu à la pharmacie", sRecv)}
          {suiviSep}
          {suiviChip("En attente de passage", sPass)}
          {suiviSep}
          {suiviChip("Récupéré", sPick)}
        </div>
      </div>
    );
  }

  return (
    <p className="text-[10px] font-semibold leading-snug text-slate-800">Suivi : statut à préciser avec l&apos;officine.</p>
  );
}
