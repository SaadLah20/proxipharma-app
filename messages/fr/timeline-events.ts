export const timelineEventsFr = {
  line: {
    origin_patient_request: {
      patient: {
        patient_requested: "Produit demandé",
        prescription_pharmacist_sourced: "Produit saisi par la pharmacie",
        pharmacist_proposed_in_response: "Produit demandé",
        added_after_confirm: "Produit demandé",
      },
      pharmacist: {
        patient_requested: "Produit demandé par le patient",
        prescription_pharmacist_sourced: "Produit saisi depuis l'ordonnance",
        pharmacist_proposed_in_response: "Produit demandé par le patient",
        added_after_confirm: "Produit demandé par le patient",
      },
    },
    origin_patient_request_updated: {
      patient: {
        patient_requested: "Demande modifiée",
        prescription_pharmacist_sourced: "Saisie modifiée par la pharmacie",
        pharmacist_proposed_in_response: "Demande modifiée",
        added_after_confirm: "Demande modifiée",
      },
      pharmacist: {
        patient_requested: "Demande modifiée par le patient",
        prescription_pharmacist_sourced: "Saisie ordonnance modifiée",
        pharmacist_proposed_in_response: "Demande modifiée par le patient",
        added_after_confirm: "Demande modifiée par le patient",
      },
    },
    origin_pharmacist_proposed: {
      patient: "Proposé par la pharmacie",
      pharmacist: "Produit proposé par l'officine",
    },
    pharmacist_response: {
      patient: {
        patient_requested: "Réponse sur votre demande",
        prescription_pharmacist_sourced: "Réponse sur ce produit",
        pharmacist_proposed_in_response: "Réponse sur votre demande",
        added_after_confirm: "Réponse sur votre demande",
      },
      pharmacist: {
        patient_requested: "Réponse publiée sur ce produit",
        prescription_pharmacist_sourced: "Réponse publiée sur ce produit",
        pharmacist_proposed_in_response: "Réponse publiée sur ce produit",
        added_after_confirm: "Réponse publiée sur ce produit",
      },
    },
    pharmacist_response_updated_line: {
      patient: "Réponse mise à jour",
      pharmacist: "Réponse modifiée sur ce produit",
    },
    patient_validation_kept: {
      patient: {
        patient_requested: "Vous l'avez retenu",
        prescription_pharmacist_sourced: "Vous l'avez retenu",
        pharmacist_proposed_in_response: "Accepté dans votre commande",
        added_after_confirm: "Vous l'avez retenu",
      },
      pharmacist: {
        patient_requested: "Retenu par le patient",
        prescription_pharmacist_sourced: "Retenu par le patient",
        pharmacist_proposed_in_response: "Accepté par le patient",
        added_after_confirm: "Retenu par le patient",
      },
    },
    patient_validation_skipped: {
      patient: {
        patient_requested: "Non retenu de votre côté",
        prescription_pharmacist_sourced: "Non retenu de votre côté",
        pharmacist_proposed_in_response: "Non accepté",
        added_after_confirm: "Non retenu de votre côté",
      },
      pharmacist: {
        patient_requested: "Non retenu",
        prescription_pharmacist_sourced: "Non retenu",
        pharmacist_proposed_in_response: "Refusé par le patient",
        added_after_confirm: "Non retenu",
      },
    },
    patient_validation_updated: {
      patient: "Validation modifiée",
      pharmacist: "Validation patient modifiée",
    },
    amend_withdraw_after_confirm: {
      patient: "Retiré de votre commande",
      pharmacist: "Produit retiré",
    },
    withdraw_auto_at_closure: {
      patient: "Retiré de votre commande",
      pharmacist: "Produit retiré",
    },
    withdraw_inferred: {
      patient: "Retiré de votre commande",
      pharmacist: "Produit retiré",
    },
    amend_reintegrate: {
      patient: "De nouveau dans votre commande",
      pharmacist: "Réintégré dans le dossier",
    },
    amend_validated_qty_change: {
      patient: "Quantité validée modifiée",
      pharmacist: "Quantité validée modifiée",
    },
    amend_line_added_after_confirm: {
      patient: "Ajouté avec votre accord",
      pharmacist: "Ajouté après validation",
    },
    amend_line_removed_after_confirm: {
      patient: "Retiré par la pharmacie",
      pharmacist: "Proposition retirée",
    },
    amend_line_brought_to_reserve: {
      patient: "Réservé en officine",
      pharmacist: "Passé en réservation",
    },
    amend_line_adjust_supply: {
      patient: "Mise à jour dispo",
      pharmacist: "Dispo modifiée",
    },
    amend_other: {
      patient: "Mise à jour enregistrée",
      pharmacist: "Modification enregistrée",
    },
    legacy_audit_adjustment: {
      patient: "Mise à jour après validation",
      pharmacist: "Modification après validation",
    },
    counter_picked_up: {
      patient: "Récupéré au comptoir",
      pharmacist: "Récupéré au comptoir",
    },
    counter_unset: {
      patient: "En attente de passage",
      pharmacist: "Remis en attente au comptoir",
    },
    counter_cancelled: {
      patient: "Non retiré au comptoir",
      pharmacist: "Non retiré au comptoir",
    },
    counter_other: {
      patient: "Passage au comptoir",
      pharmacist: "Mise a jour comptoir",
    },
    dossier_line_note: {
      patient: "Mise à jour sur ce produit",
      pharmacist: "Note sur ce produit",
    },
    epilogue_active: {
      patient: "Où ça en est",
      pharmacist: "Situation actuelle",
    },
    epilogue_archived: {
      patient: "Bilan",
      pharmacist: "État final",
    },
    fallback: {
      patient: "Mise à jour",
      pharmacist: "Événement",
    },
  },
  dossier: {
    sameStatus: {
      publication_disponibilites: {
        patient: "La pharmacie a publie sa reponse",
        pharmacist: "Reponse publiee au patient",
      },
      patient_confirm_after_response: {
        patient: "Vous avez valide votre commande",
        pharmacist: "Le patient a valide sa commande",
      },
      patient_planned_visit_updated: {
        patient: "Vous avez modifie votre date de passage",
        pharmacist: "Date de passage modifiee",
      },
      patient_update_planned_visit_after_confirmation: {
        patient: "Vous avez modifie votre date de passage",
        pharmacist: "Date de passage modifiee",
      },
      patient_resubmit_product_request_after_response: {
        patient: "Vous avez renvoye une liste de produits mise a jour",
        pharmacist: "Liste de produits renvoyee par le patient",
      },
      pharmacist_response_updated: {
        patient: "La pharmacie a modifie sa reponse",
        pharmacist: "Reponse modifiee avant validation patient",
      },
      pharmacist_adjustments_after_confirmation: {
        patient: "La pharmacie a ajuste votre commande validee",
        pharmacist: "Ajustements apres validation patient",
      },
      pharmacist_supply_amendments_saved: {
        patient: "La pharmacie a mis a jour votre commande",
        pharmacist: "Modifications enregistrees avec accord patient",
      },
      pharmacist_proposed_line_removed: {
        patient: "La pharmacie a retire une proposition",
        pharmacist: "Proposition de produit retiree",
      },
      counter_product_added: {
        patient: "Un produit a ete ajoute au suivi comptoir",
        pharmacist: "Produit ajoute au suivi comptoir",
      },
      counter_alternative_added: {
        patient: "Une alternative a ete ajoutee",
        pharmacist: "Alternative ajoutee",
      },
      counter_alternative_removed: {
        patient: "Une alternative a ete retiree",
        pharmacist: "Alternative retiree",
      },
      pharmacist_ui_confirm_close: {
        patient: "Mise a jour par la pharmacie",
        pharmacist: "Cloture ou action officine",
      },
      pharmacien_ui: {
        patient: "Mise a jour par la pharmacie",
        pharmacist: "Cloture ou action officine",
      },
      patient_abandon_request: {
        patient: "Vous avez abandonne la demande",
        pharmacist: "Abandon par le patient",
      },
      counter_picked_up: {
        patient: "Retrait au comptoir enregistre",
        pharmacist: "Retrait au comptoir enregistre",
      },
      counter_unset: {
        patient: "Produit remis en attente au comptoir",
        pharmacist: "Suivi comptoir remis en attente",
      },
      counter_cancelled_at_counter: {
        patient: "Non retire au comptoir",
        pharmacist: "Non retire au comptoir",
      },
      counter_other: {
        patient: "Mise a jour au comptoir",
        pharmacist: "Mise a jour comptoir",
      },
      auditSingle: {
        patient: "Modification apres validation patient",
        pharmacist: "Modification apres validation patient",
      },
      auditMultiple: {
        patient: "Modifications apres validation patient",
        pharmacist: "Modifications apres validation patient",
      },
      fallback: {
        patient: "Une mise a jour a ete enregistree",
        pharmacist: "Mise a jour enregistree sur le dossier",
      },
    },
    statusChange: {
      submitted_to_in_review: {
        patient: "La pharmacie ouvre le dossier",
        pharmacist: "Prise en charge interne",
      },
      in_review_to_responded: {
        patient: "La pharmacie a repondu : a valider de votre cote",
        pharmacist: "Reponse publiee au patient",
      },
      responded_to_confirmed: {
        patient: "Vous avez valide la proposition et votre passage",
        pharmacist: "Le patient a valide la selection",
      },
      responded_to_expired: {
        patient: "Delai depasse sans validation de votre part",
        pharmacist: "Delai depasse : expiree faute de validation du patient",
      },
      responded_to_abandoned: {
        patient: "Vous avez abandonne cette demande",
        pharmacist: "Abandon enregistre cote patient apres votre reponse",
      },
      confirmed_to_treated: {
        patient: "La pharmacie a termine la preparation ; passage au comptoir possible",
        pharmacist: "Dossier declare pret (comptoir)",
      },
      treated_to_completed: {
        patient: "Dossier cloture apres les retraits au comptoir",
        pharmacist: "Dossier cloture apres comptoir",
      },
      treated_to_partially_collected: {
        patient: "Cloture enregistree (retrait partiel)",
        pharmacist: "Dossier cloture apres comptoir",
      },
      treated_to_fully_collected: {
        patient: "Cloture enregistree (tout recupere)",
        pharmacist: "Dossier cloture apres comptoir",
      },
      treated_to_abandoned: {
        patient: "Dossier clos automatiquement : passage non effectue dans les delais",
        pharmacist: "Dossier clos automatiquement : passage non effectue",
      },
      any_to_cancelled: {
        patient: "La demande a ete annulee",
        pharmacist: "Demande annulee",
      },
      any_to_abandoned: {
        patient: "La demande a ete abandonnee",
        pharmacist: "Demande abandonnee par le patient",
      },
      any_to_expired: {
        patient: "La demande a expire",
        pharmacist: "Demande expiree cote patient",
      },
      fallbackPatient: "Evolution du dossier",
      fallbackPharmacist: "Le dossier passe de",
      creationPatient: {
        submitted: "Demande envoyee a la pharmacie",
        in_review: "La pharmacie traite votre demande",
      },
      creationPharmacist: {
        submitted: "Nouvelle demande recue",
      },
    },
    historyPatient: {
      submitted: "Demande envoyee a la pharmacie.",
      in_review: "La pharmacie traite votre demande.",
      submitted_to_in_review: "La pharmacie ouvre le dossier.",
      in_review_to_responded: "La pharmacie a repondu : a valider de votre cote.",
      responded_to_confirmed: "Vous avez valide la proposition et votre passage.",
      responded_to_expired: "Delai depasse sans validation de votre part.",
      responded_to_abandoned: "Vous avez abandonne cette demande.",
      confirmed_to_treated:
        "La pharmacie a termine la preparation ; passage au comptoir possible.",
      confirmed_to_processing:
        "La pharmacie suit la preparation (etape intermediaire).",
      processing_to_treated: "Preparation terminee cote officine.",
      treated_to_completed: "Dossier cloture apres les retraits au comptoir.",
      treated_to_partially_collected: "Cloture enregistree (retrait partiel).",
      treated_to_fully_collected: "Cloture enregistree (tout recupere).",
      treated_to_abandoned: "Dossier clos automatiquement : passage non effectue dans les delais.",
      cancelled: "La demande a ete annulee.",
      abandoned: "La demande a ete abandonnee.",
      expired: "La demande a expire.",
      fallback: "Etape enregistree",
      fallbackTransition: "Evolution du dossier",
    },
  },
  actors: {
    you: "Vous",
    patient: "Le patient",
    pharmacy: "La pharmacie",
    system: "Automatique",
    now: "Aujourd'hui",
    summary: "Recapitulatif",
  },
  origin: {
    patientSent: "Vous avez envoye votre demande",
    pharmacyReceived: "Demande recue",
    patientNoteAtSendPharmacist: "Note du patient a l'envoi : « {note} »",
    patientNoteAtSendPatient: "Votre message a l'envoi : « {note} »",
  },
  dossierMeta: {
    closureArchivedTitlePharmacist: "Dossier archive",
    closureArchivedTitlePatient: "Fin de votre demande",
    finalStatusPharmacist: "Statut final : {status}.",
    finalStatusPatient: "Votre demande est {status}.",
    currentTitlePharmacist: "Situation actuelle du dossier",
    currentTitlePatient: "Ou en est votre demande aujourd'hui",
    currentStatusLabel: "Statut actuel : {status}.",
    awaitingValidationPharmacist: "En attente de validation patient.",
    awaitingValidationPatient: "En attente de votre validation.",
  },
  lineBody: {
    product: "Produit : {name}",
    requestedQtyPrescription: "Quantite prescrite : {qty}",
    requestedQtyDefault: "Quantite demandee : {qty}",
    proposedQtyPrescription: "Quantite prescrite : {qty}",
    proposedQtyDefault: "Quantite proposee : {qty}",
    patientNotePharmacist: "Note patient : « {note} »",
    patientNotePatient: "Votre note : « {note} »",
    pharmacistOriginPrescription: "Ordonnance",
    pharmacistOriginProposed: "Produit propose par la pharmacie",
    pharmacistOriginLabel: "{origin} : {name}",
    motive: "Motif : {text}",
    availability: "Disponibilite : {status}",
    proposedQty: "Quantite proposee : {qty}",
    unitPrice: "Prix unitaire : {price} MAD",
    receptionPlanned: "Reception prevue : {date}",
    alternativeOne: "Alternative proposee : {name}",
    alternativesMany: "Alternatives proposees : {names}{suffix}",
    pharmacyNotePharmacist: "Note officine : « {note} »",
    pharmacyNotePatient: "Message : « {note} »",
    retainedProductAlternative: "Produit retenu : {name} (alternative)",
    retainedProduct: "Produit retenu : {name}",
    initiallyRequested: "Demandé initialement : {name}",
    retainedQty: "Quantite retenue : {qty}",
    validationSkippedProposedPharmacist: "Cette proposition n'entre pas dans la commande validee.",
    validationSkippedProposedPatient: "Cette proposition ne fait pas partie de votre commande.",
    validationSkippedProductPharmacist: "Ce produit n'entre pas dans la commande validee.",
    validationSkippedProductPatient: "Ce produit ne fait pas partie de votre commande.",
    amendmentRecorded: "Modification enregistree.",
    withdrawAutoClosurePharmacist: "Retire automatiquement a la cloture (non recupere au comptoir).",
    withdrawAutoClosurePatient: "Retire automatiquement a la cloture, car non recupere au comptoir.",
    withdrawActivePharmacist: "Retire de la commande active.",
    withdrawActivePatient: "Retire de votre commande active.",
    epilogueNotAcceptedPharmacist: "Proposition non acceptee.",
    epilogueNotAcceptedPatient: "Vous ne l'avez pas accepte.",
    epilogueNotRetainedPharmacist: "Non retenu a la validation.",
    epilogueNotRetainedPatient: "Vous ne l'avez pas retenu.",
    epiloguePickedUp: "Recupere au comptoir.",
    epilogueExpiredPharmacist: "Dossier expire.",
    epilogueExpiredPatient: "Demande expiree.",
    epilogueCancelledPharmacist: "Dossier annule ou abandonne.",
    epilogueCancelledPatient: "Demande annulee ou abandonnee.",
    epilogueClosedPharmacist: "Dossier cloture.",
    epilogueClosedPatient: "Demande terminee.",
    epilogueWithdrawnActivePharmacist: "Retire — plus dans la commande active.",
    epilogueWithdrawnActivePatient: "Retire de votre commande active.",
    preparation: "Preparation : {status}.",
    awaitingSupplier: "En attente de reception fournisseur.",
    awaitingVisitPharmacist: "En attente du passage patient.",
    awaitingVisitPatient: "En attente de votre passage.",
    receptionEta: "Reception prevue : {date}.",
    trackedQty: "Quantite suivie : {tracked} (validee : {validated}).",
    counter: "Comptoir : {label}.",
    fulfillmentReserved: "Reserve en pharmacie",
    fulfillmentOrdered: "Commande fournisseur lancee",
    fulfillmentArrived: "Recu en pharmacie, pret a retirer",
    fulfillmentPending: "En cours de precision",
  },
};
