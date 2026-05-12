-- Sur dossier déjà « treated », les entrées de journal (comptoir, ajustements supply)
-- ne doivent pas réutiliser le titre « Votre dossier est prêt pour le comptoir ».

CREATE OR REPLACE FUNCTION public._in_app_notification_patient(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_nature text,
  p_when_fr text,
  p_history_reason text DEFAULT NULL
)
RETURNS TABLE (n_title text, n_body text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_motif text;
BEGIN
  IF p_history_reason = 'patient_planned_visit_updated' THEN
    n_title := 'Passage en pharmacie mis à jour';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Votre créneau de passage prévu a été modifié. Ouvrez la demande pour voir le détail.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'Le pharmacien a mis à jour sa réponse';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour consulter les changements et ajuster votre choix si besoin.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'treated'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND (
       p_history_reason LIKE 'counter_outcome%'
       OR p_history_reason = 'pharmacist_adjustments_after_confirmation'
     ) THEN
    n_title := 'Mise à jour sur votre dossier';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nNature : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour voir le détail des changements côté officine.';
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'in_review' THEN 'Votre demande est en cours de traitement'
      WHEN 'responded' THEN 'La pharmacie vous a répondu'
      WHEN 'treated' THEN 'Votre dossier est prêt pour le comptoir'
      WHEN 'completed' THEN 'Votre demande est clôturée'
      WHEN 'cancelled' THEN 'Votre demande a été annulée'
      WHEN 'abandoned' THEN 'Votre demande a été abandonnée'
      WHEN 'expired' THEN 'Votre demande a expiré'
      ELSE 'Mise à jour de votre demande'
    END;

  v_motif := NULL;
  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_cancel|%' THEN
    v_motif := substring(p_history_reason FROM char_length('pharmacist_cancel|') + 1);
  END IF;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nNature : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || CASE p_status
      WHEN 'in_review' THEN
        E'L''officine traite votre dossier. Vous recevrez une notification dès qu''une réponse sera disponible.'
      WHEN 'responded' THEN
        E'Vous pouvez ouvrir la demande pour valider la proposition ou demander une modification.'
      WHEN 'treated' THEN
        E'Deux étapes suivent : suivre vos produits récupérables au passage ou au comptoir. Ouvrez la demande pour le détail.'
      WHEN 'completed' THEN
        E'Merci d''avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      WHEN 'cancelled' THEN
        CASE
          WHEN v_motif IS NOT NULL AND btrim(v_motif) <> '' THEN
            E'La pharmacie a annulé cette demande.' || E'\n\nMotif : ' || btrim(v_motif)
          ELSE
            E'La demande ne sera plus suivie.'
        END
      WHEN 'abandoned' THEN
        E'Le dossier a été abandonné (délai ou autre motif). Contactez la pharmacie en cas de doute.'
      WHEN 'expired' THEN
        E'Le délai de traitement est dépassé. Vous pouvez relancer une nouvelle demande.'
      ELSE
        E'Consultez le détail de la demande pour plus d''informations.'
    END;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public._in_app_notification_patient(public.request_status_enum, text, text, text, text, text) IS
  'Titres/corps notification patient ; sur treated, journal comptoir / ajustements supply → « Mise à jour sur votre dossier ».';
