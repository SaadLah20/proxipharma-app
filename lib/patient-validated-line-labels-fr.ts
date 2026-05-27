import { postConfirmSupplyAmendmentBadgeLabelsFr } from "@/lib/build-patient-line-timeline-fr";
import { formatDateShortFr } from "@/lib/datetime-fr";
import {
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import {
  isPatientAjoutOfficineLine,
  isRequestItemAddedAfterPatientConfirmation,
} from "@/lib/supply-line-post-confirm";

export type ValidatedLineLabelTone = "origin" | "status" | "event";

export type ValidatedLineLabel = {
  key: string;
  text: string;
  tone: ValidatedLineLabelTone;
};

function fulfillmentStatusLabelFr(row: PatientLineLike): string | null {
  if (!row.is_selected_by_patient) return null;
  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  if (eff === "available" || eff === "partially_available") {
    return pcf === "reserved" ? "Réservé" : "À réserver par la pharmacie";
  }
  if (eff === "to_order") {
    if (pcf === "arrived_reserved") return "Reçu en officine";
    if (pcf === "ordered") return "Commandé";
    return "À commander";
  }
  return null;
}

function mapAmendmentBadgeFr(raw: string): string | null {
  switch (raw) {
    case "Modifié après validation":
    case "Quantité ajustée":
      return "Modifié par la pharmacie";
    case "Ajouté par la pharmacie":
      return "Ajouté par la pharmacie";
    case "Retiré par la pharmacie":
    case "Retiré de la commande active":
      return "Écarté par la pharmacie";
    default:
      return null;
  }
}

/** Libellés carte validée : origine + statut préparation + événements officine, sans redondance. */
export function buildPatientValidatedLineLabelsFr(input: {
  row: PatientLineLike;
  originLabel: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  archiveClosureLabel?: string | null;
}): ValidatedLineLabel[] {
  const { row, originLabel, supplyAmendmentBundles, archiveClosureLabel } = input;
  const out: ValidatedLineLabel[] = [{ key: "origin", text: originLabel, tone: "origin" }];

  const withdrawn = Boolean(row.withdrawn_after_confirm);
  const ajoutOrigin =
    isPatientAjoutOfficineLine(row) ||
    isRequestItemAddedAfterPatientConfirmation(row.id, supplyAmendmentBundles);

  const closure = archiveClosureLabel?.trim();
  if (closure) {
    out.push({ key: "closure", text: closure, tone: "status" });
  } else if (withdrawn) {
    out.push({ key: "ecart", text: "Écarté par la pharmacie", tone: "event" });
  } else {
    const status = fulfillmentStatusLabelFr(row);
    if (status) out.push({ key: "status", text: status, tone: "status" });
    const eff = effectiveAvailabilityForPatientLine(row);
    const eta = effectiveEtaForPatientLine(row);
    if (eta && (eff === "to_order" || ajoutOrigin)) {
      out.push({
        key: "reception",
        text:
          eff === "to_order"
            ? `Réception prévue · ${formatDateShortFr(eta)}`
            : `Réception · ${formatDateShortFr(eta)}`,
        tone: "status",
      });
    }
  }

  const seenEvent = new Set<string>();
  const rawAmends = postConfirmSupplyAmendmentBadgeLabelsFr(
    row,
    supplyAmendmentBundles as { id: string; created_at: string; amendments: unknown }[]
  );
  for (const raw of rawAmends) {
    const mapped = mapAmendmentBadgeFr(raw);
    if (!mapped || seenEvent.has(mapped)) continue;
    if (mapped === "Ajouté par la pharmacie" && ajoutOrigin) continue;
    if (mapped === "Écarté par la pharmacie" && (withdrawn || out.some((l) => l.key === "ecart"))) continue;
    seenEvent.add(mapped);
    out.push({ key: `event-${mapped}`, text: mapped, tone: "event" });
  }

  return out;
}

export function validatedLineLabelChipClass(label: ValidatedLineLabel): string {
  const base = "inline-flex max-w-full shrink-0 items-center rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-tight ring-1";
  if (label.tone === "origin") {
    const t = label.text;
    if (t === "Alternative") return `${base} border-teal-500/70 bg-teal-700 text-white ring-teal-600/40`;
    if (t === "Ta demande") return `${base} border-sky-500/70 bg-sky-700 text-white ring-sky-600/40`;
    if (t === "Ordonnance" || t.startsWith("Ordonnance")) return `${base} border-amber-500/70 bg-amber-700 text-white ring-amber-600/40`;
    return `${base} border-violet-500/70 bg-violet-700 text-white ring-violet-600/40`;
  }
  if (label.tone === "status") {
    return `${base} border-emerald-400/80 bg-emerald-50 text-emerald-950 ring-emerald-200/70`;
  }
  return `${base} border-slate-300/80 bg-slate-50 text-slate-800 ring-slate-200/70`;
}

export function validatedOriginLabelFr(input: {
  row: PatientLineLike;
  requestType: string;
  pharmacistProposedBadgeLabel: string;
  prescriptionBadge: string | null;
}): string {
  const { row, prescriptionBadge, pharmacistProposedBadgeLabel } = input;
  if (prescriptionBadge) return prescriptionBadge;
  if (row.patient_chosen_alternative_id) return "Alternative";
  if (row.line_source === "pharmacist_proposed") return pharmacistProposedBadgeLabel;
  return "Ta demande";
}
