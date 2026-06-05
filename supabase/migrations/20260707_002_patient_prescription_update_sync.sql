-- Ordonnance : sync patient edit → requests.updated_at (drift UI) + request_comments (conversation).

create or replace function public._sync_prescription_patient_note_to_conversation(
  p_request_id uuid,
  p_patient_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment_id uuid;
  v_note text := nullif(trim(p_note), '');
begin
  select c.id
  into v_comment_id
  from public.request_comments c
  where c.request_id = p_request_id
    and c.author_id = p_patient_id
    and c.author_role = 'patient'::public.comment_author_role_enum
    and c.is_internal = false
    and c.deleted_at is null
    and c.comment_text is not null
    and char_length(btrim(c.comment_text)) >= 1
  order by c.created_at asc
  limit 1;

  if v_note is not null and char_length(v_note) between 1 and 2000 then
    if v_comment_id is not null then
      update public.request_comments
      set comment_text = v_note
      where id = v_comment_id;
    else
      insert into public.request_comments (
        request_id,
        author_id,
        author_role,
        comment_text,
        is_internal
      )
      values (
        p_request_id,
        p_patient_id,
        'patient'::public.comment_author_role_enum,
        v_note,
        false
      );
    end if;
  elsif v_comment_id is not null then
    delete from public.request_comments
    where id = v_comment_id;
  end if;
end;
$$;

create or replace function public.patient_update_prescription_note(
  p_request_id uuid,
  p_patient_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(trim(p_patient_note), '');
  v_status public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_prescription_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  update public.prescription_requests pr
  set patient_note = v_note
  from public.requests r
  where pr.request_id = p_request_id
    and r.id = pr.request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Ordonnance introuvable.';
  end if;

  perform public._sync_prescription_patient_note_to_conversation(p_request_id, v_uid, coalesce(v_note, ''));

  update public.requests
  set updated_at = now()
  where id = p_request_id
    and patient_id = v_uid;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_status,
    v_status,
    v_uid,
    'patient_prescription_updated'
  );
end;
$$;

create or replace function public.patient_attach_prescription_pages(
  p_request_id uuid,
  p_page1_path text,
  p_page2_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p1 text := nullif(trim(p_page1_path), '');
  v_p2 text := nullif(trim(p_page2_path), '');
  v_status public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_prescription_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  if v_p1 is null then
    raise exception 'Chemin page 1 obligatoire.';
  end if;

  if v_p1 !~ ('^ordonnances/' || p_request_id::text || '/') then
    raise exception 'Chemin page 1 invalide.';
  end if;

  if v_p2 is not null and v_p2 !~ ('^ordonnances/' || p_request_id::text || '/') then
    raise exception 'Chemin page 2 invalide.';
  end if;

  update public.prescription_requests pr
  set
    prescription_image_url = v_p1,
    page_2_path = v_p2
  from public.requests r
  where pr.request_id = p_request_id
    and r.id = pr.request_id
    and r.patient_id = v_uid
    and r.request_type = 'prescription'::public.request_type_enum;

  if not found then
    raise exception 'Demande ordonnance introuvable ou accès refusé.';
  end if;

  update public.requests
  set updated_at = now()
  where id = p_request_id
    and patient_id = v_uid;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_status,
    v_status,
    v_uid,
    'patient_prescription_updated'
  );
end;
$$;

comment on function public._sync_prescription_patient_note_to_conversation(uuid, uuid, text) is
  'Met à jour ou supprime le 1er commentaire patient du fil conversation lors d''une modification de note ordonnance.';
