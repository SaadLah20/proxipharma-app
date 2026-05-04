-- §12 Q20 : origine ligne (patient vs proposition pharmacien) + motif obligatoire pour les propositions.
-- §12 Q11 : plafond client_comment ; renvoi liste avec commentaire par ligne (RPC).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_item_line_source_enum') then
    create type public.request_item_line_source_enum as enum (
      'patient_request',
      'pharmacist_proposed'
    );
  end if;
end $$;

alter table public.request_items
  add column if not exists line_source public.request_item_line_source_enum not null default 'patient_request';

alter table public.request_items
  add column if not exists pharmacist_proposal_reason text;

update public.request_items
set line_source = 'patient_request'
where line_source is null;

alter table public.request_items drop constraint if exists request_items_line_source_reason_chk;
alter table public.request_items add constraint request_items_line_source_reason_chk check (
  (line_source = 'patient_request' and pharmacist_proposal_reason is null)
  or
  (
    line_source = 'pharmacist_proposed'
    and char_length(trim(pharmacist_proposal_reason)) >= 3
    and char_length(pharmacist_proposal_reason) <= 1000
  )
);

alter table public.request_items drop constraint if exists request_items_client_comment_len;
alter table public.request_items add constraint request_items_client_comment_len check (
  client_comment is null or char_length(client_comment) <= 500
);

comment on column public.request_items.line_source is
'patient_request | pharmacist_proposed (Q20 — propositions officine avant réponse).';

comment on column public.request_items.pharmacist_proposal_reason is
'Motif saisi par la pharmacie si la ligne est une proposition (obligatoire, 3–1000 car.).';

create or replace function public.patient_resubmit_product_request_after_response(
  p_request_id uuid,
  p_patient_note text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_patient uuid;
  v_type public.request_type_enum;
  v_el jsonb;
  v_pid uuid;
  v_qty int;
  v_cc text;
  v_seen uuid[] := array[]::uuid[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select status, patient_id, request_type
  into v_old, v_patient, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_patient <> v_uid then
    raise exception 'Forbidden';
  end if;

  if v_type <> 'product_request' then
    raise exception 'Only product_request is supported';
  end if;

  if v_old not in ('responded', 'confirmed', 'submitted', 'in_review') then
    raise exception 'Cannot resubmit from status %', v_old;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array';
  end if;

  delete from public.request_item_alternatives a
  using public.request_items ri
  where a.request_item_id = ri.id
    and ri.request_id = p_request_id;

  delete from public.request_items
  where request_id = p_request_id;

  for v_el in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_el->>'product_id')::uuid;
    v_qty := coalesce(nullif(v_el->>'requested_qty', '')::int, 0);
    v_cc := nullif(trim(v_el->>'client_comment'), '');

    if v_pid is null then
      raise exception 'Each item needs product_id';
    end if;

    if v_pid = any(v_seen) then
      raise exception 'Chaque produit ne peut figurer qu’une fois dans la liste.';
    end if;
    v_seen := array_append(v_seen, v_pid);

    if v_qty < 1 or v_qty > 10 then
      raise exception 'Quantité doit être entre 1 et 10.';
    end if;

    if v_cc is not null and char_length(v_cc) > 500 then
      raise exception 'Commentaire ligne trop long (500 caractères max).';
    end if;

    if not exists (select 1 from public.products pr where pr.id = v_pid and pr.is_active = true) then
      raise exception 'Invalid or inactive product_id %', v_pid;
    end if;

    insert into public.request_items (
      request_id,
      product_id,
      requested_qty,
      is_selected_by_patient,
      counter_outcome,
      client_comment,
      line_source
    ) values (
      p_request_id,
      v_pid,
      v_qty,
      true,
      'unset',
      v_cc,
      'patient_request'::public.request_item_line_source_enum
    );
  end loop;

  update public.product_requests
  set patient_note = case
    when p_patient_note is null then patient_note
    else nullif(trim(p_patient_note), '')
  end
  where request_id = p_request_id;

  update public.requests
  set
    status = 'submitted',
    responded_at = null,
    confirmed_at = null,
    submitted_at = now(),
    patient_planned_visit_date = null,
    patient_planned_visit_time = null,
    expires_at = null,
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'submitted', v_uid, 'patient_resubmit_product_request_after_response');
end;
$$;

comment on function public.patient_resubmit_product_request_after_response(uuid, text, jsonb) is
'Remplace lignes (qté 1–10, sans doublon) ; optional client_comment par objet JSON ; ligne patient uniquement.';
