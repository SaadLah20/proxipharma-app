-- Distinction « annulé à la demande du client » vs « annulé par la pharmacie »
-- pour les lignes en counter_outcome = 'cancelled_at_counter'.
-- Champ optionnel + détail libre (canal d'annulation : appel, comptoir, WhatsApp, etc.).

-- ---------------------------------------------------------------------------
-- Schéma : colonne counter_cancel_reason + détail libre.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'counter_cancel_reason_enum') then
    create type public.counter_cancel_reason_enum as enum (
      'client_request',
      'pharmacy_unable'
    );
  end if;
end $$;

alter table public.request_items
  add column if not exists counter_cancel_reason public.counter_cancel_reason_enum,
  add column if not exists counter_cancel_detail text;

alter table public.request_items
  drop constraint if exists request_items_counter_cancel_chk;

alter table public.request_items
  add constraint request_items_counter_cancel_chk check (
    (counter_outcome = 'cancelled_at_counter'::public.counter_line_outcome_enum)
    or (counter_cancel_reason is null and counter_cancel_detail is null)
  );

alter table public.request_items
  drop constraint if exists request_items_counter_cancel_detail_len;

alter table public.request_items
  add constraint request_items_counter_cancel_detail_len check (
    counter_cancel_detail is null or char_length(counter_cancel_detail) <= 1000
  );

comment on column public.request_items.counter_cancel_reason is
'Renseigné quand counter_outcome = cancelled_at_counter : client_request (demande du patient, peu importe le canal) ou pharmacy_unable (la pharmacie ne pouvait pas délivrer).';

comment on column public.request_items.counter_cancel_detail is
'Texte libre optionnel (≤ 1000 car.) — canal / précision d''annulation (ex. « Appel téléphonique », « Comptoir », « WhatsApp »).';

-- ---------------------------------------------------------------------------
-- RPC : pharmacist_set_item_counter_outcome — version étendue (4 args)
-- ---------------------------------------------------------------------------
drop function if exists public.pharmacist_set_item_counter_outcome(uuid, text);
drop function if exists public.pharmacist_set_item_counter_outcome(uuid, text, text, text);

create or replace function public.pharmacist_set_item_counter_outcome(
  p_request_item_id uuid,
  p_outcome text,
  p_cancel_reason text default null,
  p_cancel_detail text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new public.counter_line_outcome_enum;
  v_reason public.counter_cancel_reason_enum;
  v_detail text;
  v_req_id uuid;
  v_st public.request_status_enum;
  v_pharmacy uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  begin
    v_new := p_outcome::public.counter_line_outcome_enum;
  exception
    when invalid_text_representation then
      raise exception 'Invalid outcome %', p_outcome;
  end;

  v_detail := nullif(btrim(p_cancel_detail), '');
  if v_detail is not null and char_length(v_detail) > 1000 then
    raise exception 'Détail trop long (1000 caractères max).';
  end if;

  if v_new = 'cancelled_at_counter'::public.counter_line_outcome_enum then
    if p_cancel_reason is null or btrim(p_cancel_reason) = '' then
      raise exception 'Précisez la raison (client_request ou pharmacy_unable).';
    end if;
    begin
      v_reason := p_cancel_reason::public.counter_cancel_reason_enum;
    exception
      when invalid_text_representation then
        raise exception 'Raison d''annulation inconnue : %', p_cancel_reason;
    end;
  else
    v_reason := null;
    v_detail := null;
  end if;

  select ri.request_id, r.status, r.pharmacy_id
  into v_req_id, v_st, v_pharmacy
  from public.request_items ri
  join public.requests r on r.id = ri.request_id
  where ri.id = p_request_item_id;

  if v_req_id is null then
    raise exception 'Request item not found';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_pharmacy
      and ps.user_id = v_uid
      and p.role = 'pharmacien'
  ) then
    raise exception 'Forbidden';
  end if;

  if v_st not in ('responded', 'confirmed') then
    raise exception 'Counter updates only allowed for responded or confirmed, got %', v_st;
  end if;

  update public.request_items
  set
    counter_outcome = v_new,
    counter_cancel_reason = v_reason,
    counter_cancel_detail = v_detail,
    updated_at = now()
  where id = p_request_item_id;
end;
$$;

revoke all on function public.pharmacist_set_item_counter_outcome(uuid, text, text, text) from public;
grant execute on function public.pharmacist_set_item_counter_outcome(uuid, text, text, text) to authenticated;

comment on function public.pharmacist_set_item_counter_outcome(uuid, text, text, text) is
'Comptoir : statut ligne (unset | picked_up | cancelled_at_counter | deferred_next_visit). Pour cancelled_at_counter, la raison est obligatoire.';
