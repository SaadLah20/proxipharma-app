-- Titre notification patient : inclure clairement le nom de la pharmacie (aperçu liste / push).

create or replace function public._in_app_notification_patient(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_nature text,
  p_when_fr text
)
returns table (n_title text, n_body text)
language plpgsql
immutable
as $$
declare
  v_ph text;
begin
  v_ph := left(coalesce(nullif(btrim(p_pharma_nom::text), ''), 'Pharmacie'), 52);

  n_title :=
    case p_status
      when 'in_review' then v_ph || ' — Prise en charge de votre demande'
      when 'responded' then v_ph || ' — Réponse disponible'
      when 'completed' then v_ph || ' — Demande clôturée'
      when 'cancelled' then v_ph || ' — Demande annulée'
      when 'abandoned' then v_ph || ' — Demande abandonnée'
      when 'expired' then v_ph || ' — Demande expirée'
      else v_ph || ' — Mise à jour'
    end;

  n_body :=
    'Pharmacie : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nNature : ' || p_nature
    || E'\nMis à jour le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'in_review' then
        E'L’officine traite votre dossier. Vous recevrez une notification dès qu’une réponse sera disponible.'
      when 'responded' then
        E'Vous pouvez ouvrir la demande pour valider la proposition ou demander une modification.'
      when 'completed' then
        E'Merci d’avoir utilisé ProxiPharma. Conservez ce dossier pour votre suivi si besoin.'
      when 'cancelled' then
        E'La demande ne sera plus suivie. Vous pouvez en créer une nouvelle depuis l’annuaire si nécessaire.'
      when 'abandoned' then
        E'Le dossier a été abandonné (délai ou autre motif). Contactez la pharmacie en cas de doute.'
      when 'expired' then
        E'Le délai de traitement est dépassé. Vous pouvez relancer une nouvelle demande.'
      else
        E'Consultez le détail de la demande pour plus d’informations.'
    end;

  return next;
end;
$$;

comment on function public._in_app_notification_patient is
  'Titre + corps notification patient : nom pharmacie visible dans le titre et rappel complet dans le corps.';
