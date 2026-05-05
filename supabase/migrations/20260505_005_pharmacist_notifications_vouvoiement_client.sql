-- Notifications in-app côté pharmacien : ton « vous », nom du client visible (titre + corps).

create or replace function public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text
)
returns table (n_title text, n_body text)
language plpgsql
immutable
as $$
declare
  v_cli text;
  v_cli_short text;
begin
  v_cli := coalesce(nullif(btrim(p_patient_nom::text), ''), 'Client');
  v_cli_short := left(v_cli, 44);

  n_title :=
    case p_status
      when 'submitted' then 'Nouvelle demande — ' || v_cli_short
      when 'confirmed' then v_cli_short || ' a validé votre proposition'
      when 'cancelled' then 'Demande annulée — ' || v_cli_short
      when 'abandoned' then 'Demande abandonnée — ' || v_cli_short
      else 'Mise à jour — ' || v_cli_short
    end;

  n_body :=
    E'Client : ' || v_cli
    || E'\nType de demande : ' || p_nature
    || E'\nDate : ' || p_when_fr
    || E'\nVotre officine : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\n\n'
    || case p_status
      when 'submitted' then
        E'Une nouvelle demande vous est adressée. Ouvrez-la pour y répondre : indiquez les produits disponibles, ' ||
        E'les éventuelles alternatives et les prix. Le client sera notifié dès que vous aurez enregistré votre réponse.'
      when 'confirmed' then
        E'Ce client a confirmé la sélection proposée. Vous pouvez poursuivre la préparation et le retrait au comptoir ' ||
        E'comme convenu avec lui.'
      when 'cancelled' then
        E'Cette demande est passée au statut annulé. Vous n’avez pas d’action obligatoire ; consultez le dossier si vous ' ||
        E'deviez ajuster une réservation de stock.'
      when 'abandoned' then
        E'Cette demande a été abandonnée côté patient ou workflow. Vérifiez le détail si vous devez libérer du stock ' ||
        E'ou contacter le client.'
      else
        E'Ouvrez le dossier pour voir le contexte et la suite à donner.'
    end;

  return next;
end;
$$;

comment on function public._in_app_notification_pharmacist is
  'Titres et corps notification pharmacien : vouvoiement, nom du client en tête.';
