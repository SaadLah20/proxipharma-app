import type { ProductLineJourneyKind } from "@/lib/product-line-history/line-journey";
import type { LineEventKind, LineHistoryPhase } from "@/lib/product-line-history/types";

export type LineHistoryAudience = "patient" | "pharmacist";

export const LINE_HISTORY_PHASE_LABELS: Record<
  LineHistoryPhase,
  { patient: string; pharmacist: string }
> = {
  origin: { patient: "Envoi", pharmacist: "Demande reçue" },
  response: { patient: "Réponse", pharmacist: "Réponse officine" },
  validation: { patient: "Validation", pharmacist: "Validation patient" },
  preparation: { patient: "Préparation", pharmacist: "Suivi officine" },
  counter: { patient: "Comptoir", pharmacist: "Comptoir" },
  epilogue: { patient: "Situation", pharmacist: "Situation" },
};

const AMEND_KIND_TO_EVENT: Record<string, LineEventKind> = {
  line_adjust_supply: "amend_line_adjust_supply",
  validated_qty_change: "amend_validated_qty_change",
  withdraw_after_confirm: "amend_withdraw_after_confirm",
  line_added_after_confirm: "amend_line_added_after_confirm",
  line_removed_after_confirm: "amend_line_removed_after_confirm",
  reintegrate_after_confirm: "amend_reintegrate",
  reintegrate: "amend_reintegrate",
  line_brought_to_reserve_after_validation: "amend_line_brought_to_reserve",
};

export function supplyAmendmentKindToLineEventKind(kind: string | undefined): LineEventKind {
  const k = (kind ?? "").trim();
  return AMEND_KIND_TO_EVENT[k] ?? "amend_other";
}

/** Titre narratif d’un événement (modal historique). */
export function lineEventTitle(
  kind: LineEventKind,
  audience: LineHistoryAudience,
  journey: ProductLineJourneyKind = "patient_requested"
): string {
  const ph = audience === "pharmacist";
  switch (kind) {
    case "origin_patient_request":
      return ph ? "Produit demandé par le patient" : "Produit demandé";
    case "origin_patient_request_updated":
      return ph ? "Demande modifiée par le patient" : "Demande modifiée";
    case "origin_pharmacist_proposed":
      return ph ? "Produit proposé par l'officine" : "Proposé par la pharmacie";
    case "pharmacist_response":
      return ph ? "Réponse publiée sur ce produit" : "Réponse sur votre demande";
    case "pharmacist_response_updated_line":
      return ph ? "Réponse modifiée sur ce produit" : "Réponse mise à jour";
    case "patient_validation_kept":
      if (journey === "pharmacist_proposed_in_response") {
        return ph ? "Accepté par le patient" : "Accepté dans votre commande";
      }
      return ph ? "Retenu par le patient" : "Vous l'avez retenu";
    case "patient_validation_skipped":
      if (journey === "pharmacist_proposed_in_response") {
        return ph ? "Refusé par le patient" : "Non accepté";
      }
      return ph ? "Non retenu" : "Non retenu de votre côté";
    case "patient_validation_updated":
      return ph ? "Validation patient modifiée" : "Validation modifiée";
    case "amend_withdraw_after_confirm":
    case "withdraw_auto_at_closure":
    case "withdraw_inferred":
      return ph ? "Produit retiré" : "Retiré de votre commande";
    case "amend_reintegrate":
      return ph ? "Réintégré dans le dossier" : "De nouveau dans votre commande";
    case "amend_validated_qty_change":
      return ph ? "Quantité validée modifiée" : "Quantité validée modifiée";
    case "amend_line_added_after_confirm":
      return ph ? "Ajouté après validation" : "Ajouté avec votre accord";
    case "amend_line_removed_after_confirm":
      return ph ? "Proposition retirée" : "Retiré par la pharmacie";
    case "amend_line_brought_to_reserve":
      return ph ? "Passé en réservation" : "Réservé en officine";
    case "amend_line_adjust_supply":
      return ph ? "Dispo modifiée" : "Mise à jour dispo";
    case "amend_other":
      return ph ? "Modification enregistrée" : "Mise à jour enregistrée";
    case "legacy_audit_adjustment":
      return ph ? "Modification après validation" : "Mise à jour après validation";
    case "counter_picked_up":
      return "Récupéré au comptoir";
    case "counter_unset":
      return ph ? "Remis en attente au comptoir" : "En attente de passage";
    case "counter_cancelled":
      return ph ? "Non retiré au comptoir" : "Non retiré au comptoir";
    case "counter_other":
      return ph ? "Mise à jour comptoir" : "Passage au comptoir";
    case "dossier_line_note":
      return ph ? "Note sur ce produit" : "Mise à jour sur ce produit";
    case "epilogue_active":
      return ph ? "Situation actuelle" : "Où ça en est";
    case "epilogue_archived":
      return ph ? "État final" : "Bilan";
    default:
      return ph ? "Événement" : "Mise à jour";
  }
}

/** Pastille courte sur la carte produit (alignée sur l’historique). */
export function lineEventBadgeLabel(kind: LineEventKind | string): string | null {
  switch (kind) {
    case "amend_line_adjust_supply":
      return "Modifié après validation";
    case "amend_validated_qty_change":
      return "Quantité ajustée";
    case "amend_line_added_after_confirm":
      return "Ajouté par la pharmacie";
    case "amend_line_removed_after_confirm":
      return "Retiré par la pharmacie";
    case "amend_withdraw_after_confirm":
    case "withdraw_auto_at_closure":
    case "withdraw_inferred":
      return "Retiré de la commande active";
    case "amend_reintegrate":
      return "Réintégré";
    case "amend_line_brought_to_reserve":
      return "Replacé en « à réserver »";
    case "counter_picked_up":
      return "Récupéré au comptoir";
    default:
      return null;
  }
}

/** Corps naturel pour un amendement (1 fait par ligne). */
export function supplyAmendmentBodyFact(
  kind: string | undefined,
  audience: LineHistoryAudience
): string | null {
  const ph = audience === "pharmacist";
  switch (kind) {
    case "withdraw_after_confirm":
      return ph
        ? "Retiré de la commande active (accord patient)."
        : "Retiré de votre commande après validation.";
    case "reintegrate_after_confirm":
    case "reintegrate":
      return ph ? "Réintégré dans la commande." : "Réintégré dans votre commande.";
    case "validated_qty_change":
      return ph ? "Quantité validée ajustée." : "Quantité validée modifiée.";
    case "line_added_after_confirm":
      return ph ? "Produit ajouté après validation patient." : "Produit ajouté avec votre accord.";
    case "line_removed_after_confirm":
      return ph ? "Proposition retirée après validation." : "Proposition retirée par la pharmacie.";
    case "line_brought_to_reserve_after_validation":
      return ph ? "Passage en « à réserver »." : "Replacé en réservation en officine.";
    case "line_adjust_supply":
      return ph ? "Disponibilité ou quantité modifiée." : "Disponibilité ou quantité modifiée.";
    default:
      return null;
  }
}
