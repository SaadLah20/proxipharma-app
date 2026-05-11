-- Corps des notifications in-app pharmacien : sans répétition du nom d'officine ni de la date
-- (déjà visibles dans l'UI liste / détail). Le titre et l'horodatage de la notif restent affichés côté app.

CREATE OR REPLACE FUNCTION public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text DEFAULT NULL
)
RETURNS TABLE (n_title text, n_body text)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_is_update_submitted boolean := false;
  v_ph_cancel_motif text;
BEGIN
  v_is_update_submitted :=
    p_status = 'submitted'
    AND p_old_status IS NOT NULL
    AND p_old_status <> 'draft';

  IF p_history_reason IS NOT NULL AND p_history_reason LIKE 'pharmacist_cancel|%' THEN
    v_ph_cancel_motif := substring(p_history_reason FROM char_length('pharmacist_cancel|') + 1);
  ELSE
    v_ph_cancel_motif := NULL;
  END IF;

  n_title :=
    CASE p_status
      WHEN 'submitted' THEN
        CASE WHEN v_is_update_submitted THEN 'Le patient a mis à jour sa demande' ELSE 'Vous avez une nouvelle demande à traiter' END
      WHEN 'confirmed' THEN 'Le patient a validé votre proposition'
      WHEN 'processing' THEN 'Suivi dossier après validation patient'
      WHEN 'treated' THEN 'Dossier traité — retraits comptoir'
      WHEN 'cancelled' THEN
        CASE WHEN v_ph_cancel_motif IS NOT NULL AND btrim(v_ph_cancel_motif) <> '' THEN 'Demande annulée par l''officine' ELSE 'Une demande a été annulée' END
      WHEN 'abandoned' THEN 'Une demande a été abandonnée'
      WHEN 'expired' THEN 'Une demande a expiré (sans validation patient)'
      ELSE 'Mise à jour d''une demande'
    END;

  n_body :=
    'Patient : ' || coalesce(p_patient_nom, '—')
    || E'\nNature : ' || p_nature
    || E'\n\n'
    || CASE p_status
      WHEN 'submitted' THEN
        CASE WHEN v_is_update_submitted THEN E'Ouvrez la demande pour la version à jour.' ELSE E'Ouvrez la demande pour préparer votre réponse.' END
      WHEN 'confirmed' THEN E'Le patient a confirmé la sélection. Vous pouvez poursuivre la préparation.'
      WHEN 'processing' THEN E'Le dossier figure en préparation officine après validation.'
      WHEN 'treated' THEN E'Le patient doit pouvoir passer au comptoir. Indiquez les retraits ligne par ligne jusqu''à la clôture.'
      WHEN 'cancelled' THEN
        CASE WHEN v_ph_cancel_motif IS NOT NULL AND btrim(v_ph_cancel_motif) <> '' THEN E'Motif enregistré : ' || btrim(v_ph_cancel_motif) ELSE E'La demande est passée en annulée.' END
      WHEN 'abandoned' THEN E'Demande abandonnée côté patient.'
      WHEN 'expired' THEN E'Délai dépassé sans action du patient.'
      ELSE E'Consultez le dossier.'
    END;

  RETURN NEXT;
END;
$$;
