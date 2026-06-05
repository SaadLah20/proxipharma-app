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
import {
  PRESCRIPTION_PRINCIPAL_BADGE,
  validatedOriginFallbackPatientFr,
  validatedOriginFallbackPharmacistFr,
} from "@/lib/prescription-ui-copy";

export type ValidatedLineLabelTone = "origin" | "status" | "event" | "reception" | "arrived" | "collected";

export type ValidatedLineLabel = {
  key: string;
  text: string;
  tone: ValidatedLineLabelTone;
};

const TREATED_OMIT_STATUS_RE =
  /réservé|commandé|à réserver|à commander/i;

function fulfillmentStatusLabelFr(
  row: PatientLineLike,
  treatedLineLabels?: boolean,
  labelAudience: "patient" | "pharmacist" = "patient"
): string | null {
  if (!row.is_selected_by_patient) return null;
  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  if (treatedLineLabels) {
    if (eff === "available" || eff === "partially_available") {
      if (pcf === "reserved") return null;
      return labelAudience === "pharmacist"
        ? "Passage patient en attente"
        : "En attente de votre passage";
    }
    if (eff === "to_order") {
      if (pcf === "arrived_reserved") {
        return labelAudience === "pharmacist" ? null : "Reçu en officine";
      }
      return null;
    }
    return null;
  }
  if (eff === "available" || eff === "partially_available") {
    if (pcf === "reserved") return "Réservé";
    return labelAudience === "pharmacist" ? "À réserver" : "À réserver par la pharmacie";
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
    case "Écarté de la commande active":
      return "Retiré";
    case "Récupéré au comptoir":
      return "Récupéré au comptoir";
    default:
      return null;
  }
}

function isDefaultPatientOriginLabel(label: string): boolean {
  return (
    label === "Ta demande" ||
    label === "Demande patient" ||
    label === PRESCRIPTION_PRINCIPAL_BADGE
  );
}

function isRedundantSectionStatusLabel(
  status: string,
  sectionBucket?:
    | "dispo_officine"
    | "commande"
    | "hors_perimetre"
    | "retire_apres_validation"
    | "non_retenu",
  treatedLineLabels?: boolean
): boolean {
  if (!sectionBucket) return false;
  if (
    sectionBucket === "dispo_officine" &&
    (status === "À réserver par la pharmacie" || status === "À réserver")
  ) {
    return true;
  }
  if (sectionBucket === "commande" && (status === "À commander" || status === "Commandé")) {
    return true;
  }
  if (
    treatedLineLabels &&
    sectionBucket === "dispo_officine" &&
    (status === "En attente de votre passage" || status === "Passage patient en attente")
  ) {
    return true;
  }
  return false;
}

/** Libellés carte validée : origine + statut préparation + événements officine, sans redondance. */
export function buildPatientValidatedLineLabelsFr(input: {
  row: PatientLineLike;
  originLabel: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  archiveClosureLabel?: string | null;
  /** Demande traitée : pas de pastilles « réservé / commandé » (déjà dans les blocs). */
  treatedLineLabels?: boolean;
  /** Groupe d’affichage : masque les libellés déjà portés par le titre de section. */
  sectionBucket?:
    | "dispo_officine"
    | "commande"
    | "hors_perimetre"
    | "retire_apres_validation"
    | "non_retenu";
  /** Dossier traité côté officine : formulations sans « vous », pastilles redondantes avec les CTA. */
  labelAudience?: "patient" | "pharmacist";
}): ValidatedLineLabel[] {
  const {
    row,
    originLabel,
    supplyAmendmentBundles,
    archiveClosureLabel,
    treatedLineLabels,
    sectionBucket,
    labelAudience = "patient",
  } = input;
  const out: ValidatedLineLabel[] = [];
  if (!isDefaultPatientOriginLabel(originLabel)) {
    out.push({ key: "origin", text: originLabel, tone: "origin" });
  }

  const withdrawn = Boolean(row.withdrawn_after_confirm);
  const ajoutOrigin =
    isPatientAjoutOfficineLine(row) ||
    isRequestItemAddedAfterPatientConfirmation(row.id, supplyAmendmentBundles);

  const closure = archiveClosureLabel?.trim();
  const pickedUp = (row.counter_outcome ?? "unset") === "picked_up";
  if (closure) {
    out.push({ key: "closure", text: closure, tone: "status" });
  } else if (withdrawn) {
    out.push({ key: "ecart", text: "Retiré par la pharmacie", tone: "event" });
  } else if (pickedUp) {
    // Patient : pastille « Récupéré ». Pharmacien dossier traité : le bouton comptoir suffit.
    if (labelAudience !== "pharmacist") {
      out.push({ key: "collected", text: "Récupéré", tone: "collected" });
    }
  } else {
    const status = fulfillmentStatusLabelFr(row, treatedLineLabels, labelAudience);
    if (
      status &&
      !(treatedLineLabels && TREATED_OMIT_STATUS_RE.test(status)) &&
      !isRedundantSectionStatusLabel(status, sectionBucket, treatedLineLabels)
    ) {
      out.push({
        key: status === "Reçu en officine" ? "arrived" : "status",
        text: status,
        tone: status === "Reçu en officine" ? "arrived" : "status",
      });
    }
    const eff = effectiveAvailabilityForPatientLine(row);
    const eta = effectiveEtaForPatientLine(row);
    const pcf = row.post_confirm_fulfillment ?? "unset";
    const receivedAtPharmacy = pcf === "arrived_reserved";
    if (eta && (eff === "to_order" || ajoutOrigin) && !receivedAtPharmacy) {
      out.push({
        key: "reception",
        text:
          eff === "to_order"
            ? `Réception prévue · ${formatDateShortFr(eta)}`
            : `Réception · ${formatDateShortFr(eta)}`,
        tone: "reception",
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
    if (mapped === "Retiré par la pharmacie" && (withdrawn || out.some((l) => l.key === "ecart"))) continue;
    seenEvent.add(mapped);
    out.push({ key: `event-${mapped}`, text: mapped, tone: "event" });
  }

  return out;
}

export function validatedLineLabelChipClass(label: ValidatedLineLabel): string {
  const base =
    "inline-flex max-w-full shrink-0 items-center rounded border px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide leading-tight";
  if (label.tone === "origin") {
    const t = label.text;
    if (t === "Alternative") return `${base} border-teal-300/70 bg-teal-50/40 text-teal-900/90`;
    if (t === "Ta demande" || t === "Demande patient") return `${base} border-sky-300/70 bg-sky-50/35 text-sky-900/90`;
    if (t === "Ordonnance" || t.startsWith("Ordonnance")) return `${base} border-amber-300/70 bg-amber-50/40 text-amber-900/90`;
    return `${base} border-violet-300/70 bg-violet-50/35 text-violet-900/90`;
  }
  if (label.tone === "reception" || label.key === "reception") {
    return `${base} border-teal-300/70 bg-teal-50/35 text-teal-900/90`;
  }
  if (label.tone === "collected" || label.text === "Récupéré") {
    return `${base} border-emerald-300/70 bg-emerald-50/35 text-emerald-900/90`;
  }
  if (label.tone === "arrived" || label.text === "Reçu en officine") {
    return `${base} border-emerald-300/70 bg-emerald-50/35 text-emerald-900/90`;
  }
  if (label.tone === "status") {
    return `${base} border-sky-300/70 bg-sky-50/35 text-sky-900/90`;
  }
  return `${base} border-border/80 bg-muted/25 text-foreground/85`;
}

/** Libellé origine côté officine (miroir patient, vocabulaire pharmacien). */
export function validatedOriginLabelPharmacistFr(input: {
  row: PatientLineLike;
  requestType: string;
  pharmacistProposedBadgeLabel: string;
  prescriptionBadge: string | null;
}): string {
  const label = validatedOriginLabelFr(input);
  if (label === validatedOriginFallbackPatientFr(input.requestType)) {
    return validatedOriginFallbackPharmacistFr(input.requestType);
  }
  return label;
}

export function validatedOriginLabelFr(input: {
  row: PatientLineLike;
  requestType: string;
  pharmacistProposedBadgeLabel: string;
  prescriptionBadge: string | null;
}): string {
  const { row, prescriptionBadge, pharmacistProposedBadgeLabel, requestType } = input;
  if (prescriptionBadge) return prescriptionBadge;
  if (row.patient_chosen_alternative_id) return "Alternative";
  if (row.line_source === "pharmacist_proposed") return pharmacistProposedBadgeLabel;
  return validatedOriginFallbackPatientFr(requestType);
}
