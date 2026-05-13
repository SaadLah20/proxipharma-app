-- Libellés in-app patient : formulations plus simples (traité, abandonné) + en-tête « Dossier » au lieu de « Nature ».
--
-- Anciennes migrations ont pu laisser deux surcharges (5 args vs 6 args) : CREATE OR REPLACE
-- et COMMENT sans signature échouent alors (42725). On retire explicitement les deux formes.

DROP FUNCTION IF EXISTS public._in_app_notification_patient(
  public.request_status_enum,
  text,
  text,
  text,
  text
);

DROP FUNCTION IF EXISTS public._in_app_notification_patient(
  public.request_status_enum,
  text,
  text,
  text,
  text,
  text
);

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
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Votre créneau de passage prévu a été modifié. Ouvrez la demande pour voir le détail.';
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_status = 'responded'::public.request_status_enum
     AND p_history_reason IS NOT NULL
     AND p_history_reason = 'pharmacist_response_updated' THEN
    n_title := 'La pharmacie a mis à jour sa réponse';
    n_body :=
      'Pharmacie : ' || coalesce(p_pharma_nom, '—')
      || ' · ' || coalesce(p_pharma_ville, '—')
      || E'\nDossier : ' || p_nature
      || E'\nMis à jour le : ' || p_when_fr
      || E'\n\n'
      || E'Ouvrez la demande pour voir ce qui a changé et ajuster votre choix si besoin.';
    RETURN NEXT;
    RETURN;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'in_review' THEN 'Votre demande est en cours de traitement'
      WHEN 'responded' THEN 'La pharmacie vous a répondu'
      WHEN 'treated' THEN 'Votre commande est prête en pharmacie'
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
    || E'\nDossier : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || CASE p_status
      WHEN 'in_review' THEN
        E'L''officine traite votre dossier. Vous recevrez une notification dès qu''une réponse sera disponible.'
      WHEN 'responded' THEN
        E'Ouvrez la demande pour valider la proposition ou demander une modification avant expiration.'
      WHEN 'treated' THEN
        E'La pharmacie a terminé la préparation. Ouvrez la demande : vous y verrez ce que vous pouvez retirer au comptoir et comment mettre à jour votre passage.'
      WHEN 'completed' THEN
        E'Merci d''avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      WHEN 'cancelled' THEN
        CASE
          WHEN v_motif IS NOT NULL AND btrim(v_motif) <> '' THEN
            E'La pharmacie a annulé cette demande.' || E'\n\nPrécision : ' || btrim(v_motif)
          ELSE
            E'La demande ne sera plus suivie.'
        END
      WHEN 'abandoned' THEN
        E'Ce dossier est fermé. Pour la suite, rapprochez-vous directement de votre pharmacie si besoin.'
      WHEN 'expired' THEN
        E'Le délai de traitement est dépassé. Vous pouvez créer une nouvelle demande si nécessaire.'
      ELSE
        E'Consultez le détail de la demande pour plus d''informations.'
    END;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public._in_app_notification_patient(
  public.request_status_enum,
  text,
  text,
  text,
  text,
  text
) IS
  'Titres/corps notification patient (mai 2026) : libellés simplifiés, dossier traité = passage comptoir.';
