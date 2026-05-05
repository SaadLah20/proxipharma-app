-- Notifications in-app : textes orientés patient vs pharmacien + contexte (pharmacie, nature, date).
-- Mesure d’audience fiche / clics (hors demandes) pour tableau de bord pharmacien.

-- ---------------------------------------------------------------------------
-- Suivi des vues fiche et clics téléphone / WhatsApp (annuaire ou fiche détail)
-- ---------------------------------------------------------------------------
create table if not exists public.pharmacy_engagement_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  event_type text not null
    check (event_type in ('profile_view', 'phone_click', 'whatsapp_click')),
  source text not null default 'profile'
    check (source in ('annuaire', 'profile'))
);

create index if not exists pharmacy_engagement_events_pharmacy_created_idx
  on public.pharmacy_engagement_events (pharmacy_id, created_at desc);

comment on table public.pharmacy_engagement_events is
  'Événements agrégés : consultations de fiche, clics appel / WhatsApp (source annuaire ou page fiche).';

alter table public.pharmacy_engagement_events enable row level security;

drop policy if exists "pharmacy_engagement_select_staff" on public.pharmacy_engagement_events;
create policy "pharmacy_engagement_select_staff"
on public.pharmacy_engagement_events
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.pharmacy_staff ps
    where ps.user_id = auth.uid()
      and ps.pharmacy_id = pharmacy_engagement_events.pharmacy_id
  )
);

drop policy if exists "pharmacy_engagement_insert_public" on public.pharmacy_engagement_events;
create policy "pharmacy_engagement_insert_public"
on public.pharmacy_engagement_events
for insert
to anon, authenticated
with check (true);

-- ---------------------------------------------------------------------------
-- Libellés de notification (patient vs pharmacien) + corps structuré
-- ---------------------------------------------------------------------------
create or replace function public._request_type_label_fr(p public.request_type_enum)
returns text
language sql
immutable
as $$
  select case p
    when 'product_request' then 'Demande de produits'
    when 'prescription' then 'Ordonnance'
    when 'free_consultation' then 'Consultation libre'
    else 'Demande'
  end;
$$;

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
begin
  n_title :=
    case p_status
      when 'in_review' then 'Votre demande est en cours de traitement'
      when 'responded' then 'La pharmacie vous a répondu'
      when 'completed' then 'Votre demande est clôturée'
      when 'cancelled' then 'Votre demande a été annulée'
      when 'abandoned' then 'Votre demande a été abandonnée'
      when 'expired' then 'Votre demande a expiré'
      else 'Mise à jour de votre demande'
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
begin
  n_title :=
    case p_status
      when 'submitted' then 'Vous avez une nouvelle demande à traiter'
      when 'confirmed' then 'Le patient a validé votre proposition'
      when 'cancelled' then 'Une demande a été annulée'
      when 'abandoned' then 'Une demande a été abandonnée'
      else 'Mise à jour d’une demande'
    end;

  n_body :=
    'Votre officine : ' || coalesce(p_pharma_nom, '—')
    || ' · ' || coalesce(p_pharma_ville, '—')
    || E'\nPatient : ' || coalesce(p_patient_nom, '—')
    || E'\nNature : ' || p_nature
    || E'\nÉvénement le : ' || p_when_fr
    || E'\n\n'
    || case p_status
      when 'submitted' then
        E'Ouvrez la demande pour préparer votre réponse et indiquer les produits disponibles ou les alternatives.'
      when 'confirmed' then
        E'Le patient a confirmé la sélection. Vous pouvez poursuivre la préparation / le retrait au comptoir.'
      when 'cancelled' then
        E'La demande est passée en annulée. Aucune action supplémentaire n’est requise de votre côté.'
      when 'abandoned' then
        E'La demande a été abandonnée. Vérifiez le détail si vous devez libérer du stock réservé.'
      else
        E'Consultez le dossier pour le contexte complet.'
    end;

  return next;
end;
$$;

create or replace function public._emit_in_app_notifications_for_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_pharma_nom text;
  v_pharma_ville text;
  v_patient_nom text;
  v_nature text;
  v_when_fr text;
  v_title_pat text;
  v_body_pat text;
  v_title_ph text;
  v_body_ph text;
begin
  if new.new_status not in (
    'submitted', 'in_review', 'responded', 'confirmed', 'completed',
    'cancelled', 'abandoned', 'expired'
  ) then
    return new;
  end if;

  select r.* into v_req
  from public.requests r
  where r.id = new.request_id;

  if not found then
    return new;
  end if;

  select ph.nom, ph.ville
  into v_pharma_nom, v_pharma_ville
  from public.pharmacies ph
  where ph.id = v_req.pharmacy_id;

  select coalesce(nullif(btrim(p.full_name::text), ''), 'Patient')
  into v_patient_nom
  from public.profiles p
  where p.id = v_req.patient_id;

  v_nature := public._request_type_label_fr(v_req.request_type);
  v_when_fr := to_char(
    new.created_at at time zone 'Africa/Casablanca',
    'DD/MM/YYYY à HH24:MI'
  );

  if new.new_status in ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired') then
    select t.n_title, t.n_body
    into v_title_pat, v_body_pat
    from public._in_app_notification_patient(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_nature,
      v_when_fr
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    values (
      v_req.patient_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_pat,
      v_body_pat
    )
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled') then
    select t.n_title, t.n_body
    into v_title_ph, v_body_ph
    from public._in_app_notification_pharmacist(
      new.new_status,
      v_pharma_nom,
      v_pharma_ville,
      v_patient_nom,
      v_nature,
      v_when_fr
    ) as t;

    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    select
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title_ph,
      v_body_ph
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id)
    do nothing;
  end if;

  return new;
end;
$$;

-- Anciennes fonctions génériques (remplacées par le couple patient / pharmacien)
drop function if exists public._request_status_notification_message(public.request_status_enum);
drop function if exists public._request_status_notification_title(public.request_status_enum);

comment on function public._emit_in_app_notifications_for_status_history() is
  'Insère des notifications lisibles (vous / votre officine, contexte pharmacie + nature + date) pour patient et pharmacien.';
