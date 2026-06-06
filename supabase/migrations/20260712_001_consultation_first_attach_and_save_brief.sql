-- Consultation : pas de notif « mise à jour » au 1er attach (envoi patient) ; sauvegarde brief unifiée.

create or replace function public._patient_consultation_edit_finalize(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.request_status_enum;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.free_consultation_requests fcr
  set patient_content_updated_at = now()
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id
    and r.patient_id = v_uid;

  if not found then
    raise exception 'Consultation introuvable.';
  end if;

  update public.requests
  set updated_at = now()
  where id = p_request_id;

  select r.status into v_status
  from public.requests r
  where r.id = p_request_id;

  perform public._log_request_status_change(
    p_request_id,
    v_status,
    v_status,
    v_uid,
    'patient_consultation_updated'
  );
end;
$$;

create or replace function public.patient_update_consultation_text(
  p_request_id uuid,
  p_consultation_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := trim(p_consultation_text);
  v_prev text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_consultation_before_response(p_request_id) then
    raise exception 'Modification impossible : le dossier n''est plus modifiable à ce stade.';
  end if;

  if v_text is null or char_length(v_text) < 10 then
    raise exception 'Le texte doit contenir au moins 10 caractères (vous ne pouvez pas le vider).';
  end if;

  if char_length(v_text) > 1500 then
    raise exception 'Texte trop long (1500 caractères max).';
  end if;

  select trim(fcr.consultation_text)
  into v_prev
  from public.free_consultation_requests fcr
  join public.requests r on r.id = fcr.request_id
  where fcr.request_id = p_request_id
    and r.patient_id = auth.uid();

  if not found then
    raise exception 'Consultation introuvable.';
  end if;

  if v_prev = v_text then
    return;
  end if;

  update public.free_consultation_requests fcr
  set consultation_text = v_text
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id;

  perform public._patient_consultation_edit_finalize(p_request_id);
end;
$$;

create or replace function public.patient_attach_consultation_images(
  p_request_id uuid,
  p_image_1_path text default null,
  p_image_2_path text default null,
  p_image_3_path text default null,
  p_initial_submit boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p1 text := nullif(trim(p_image_1_path), '');
  v_p2 text := nullif(trim(p_image_2_path), '');
  v_p3 text := nullif(trim(p_image_3_path), '');
  v_prefix text := 'consultations/' || p_request_id::text || '/';
  v_prev_1 text;
  v_prev_2 text;
  v_prev_3 text;
  v_paths_changed boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_consultation_before_response(p_request_id) then
    raise exception 'Les photos ne sont plus modifiables à ce stade.';
  end if;

  if v_p1 is not null and v_p1 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 1 invalide.';
  end if;
  if v_p2 is not null and v_p2 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 2 invalide.';
  end if;
  if v_p3 is not null and v_p3 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 3 invalide.';
  end if;

  select fcr.image_1_path, fcr.image_2_path, fcr.image_3_path
  into v_prev_1, v_prev_2, v_prev_3
  from public.free_consultation_requests fcr
  join public.requests r on r.id = fcr.request_id
  where fcr.request_id = p_request_id
    and r.patient_id = auth.uid()
    and r.request_type = 'free_consultation'::public.request_type_enum;

  if not found then
    raise exception 'Consultation introuvable ou accès refusé.';
  end if;

  if p_initial_submit then
    if coalesce(v_prev_1, v_prev_2, v_prev_3) is not null then
      raise exception 'Photos déjà enregistrées pour ce dossier.';
    end if;
  end if;

  v_paths_changed :=
    coalesce(v_prev_1, '') is distinct from coalesce(v_p1, '')
    or coalesce(v_prev_2, '') is distinct from coalesce(v_p2, '')
    or coalesce(v_prev_3, '') is distinct from coalesce(v_p3, '');

  if not v_paths_changed then
    return;
  end if;

  update public.free_consultation_requests fcr
  set
    image_1_path = v_p1,
    image_2_path = v_p2,
    image_3_path = v_p3
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id
    and r.patient_id = auth.uid()
    and r.request_type = 'free_consultation'::public.request_type_enum;

  update public.requests
  set updated_at = now()
  where id = p_request_id
    and patient_id = auth.uid();

  if p_initial_submit then
    return;
  end if;

  perform public._patient_consultation_edit_finalize(p_request_id);
end;
$$;

comment on function public.patient_attach_consultation_images(uuid, text, text, text, boolean) is
  'Attach photos consultation ; p_initial_submit=true au 1er envoi (pas de notif mise à jour).';

create or replace function public.patient_save_consultation_brief(
  p_request_id uuid,
  p_consultation_text text,
  p_image_1_path text default null,
  p_image_2_path text default null,
  p_image_3_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := trim(p_consultation_text);
  v_p1 text := nullif(trim(p_image_1_path), '');
  v_p2 text := nullif(trim(p_image_2_path), '');
  v_p3 text := nullif(trim(p_image_3_path), '');
  v_prefix text := 'consultations/' || p_request_id::text || '/';
  v_prev_text text;
  v_prev_1 text;
  v_prev_2 text;
  v_prev_3 text;
  v_text_changed boolean;
  v_paths_changed boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public._patient_can_edit_consultation_before_response(p_request_id) then
    raise exception 'Modification impossible à ce stade.';
  end if;

  if v_text is null or char_length(v_text) < 10 then
    raise exception 'Le texte doit contenir au moins 10 caractères (vous ne pouvez pas le vider).';
  end if;

  if char_length(v_text) > 1500 then
    raise exception 'Texte trop long (1500 caractères max).';
  end if;

  if v_p1 is not null and v_p1 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 1 invalide.';
  end if;
  if v_p2 is not null and v_p2 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 2 invalide.';
  end if;
  if v_p3 is not null and v_p3 !~ ('^' || v_prefix) then
    raise exception 'Chemin photo 3 invalide.';
  end if;

  select trim(fcr.consultation_text), fcr.image_1_path, fcr.image_2_path, fcr.image_3_path
  into v_prev_text, v_prev_1, v_prev_2, v_prev_3
  from public.free_consultation_requests fcr
  join public.requests r on r.id = fcr.request_id
  where fcr.request_id = p_request_id
    and r.patient_id = v_uid
    and r.request_type = 'free_consultation'::public.request_type_enum;

  if not found then
    raise exception 'Consultation introuvable.';
  end if;

  v_text_changed := v_prev_text is distinct from v_text;
  v_paths_changed :=
    coalesce(v_prev_1, '') is distinct from coalesce(v_p1, '')
    or coalesce(v_prev_2, '') is distinct from coalesce(v_p2, '')
    or coalesce(v_prev_3, '') is distinct from coalesce(v_p3, '');

  if not v_text_changed and not v_paths_changed then
    return;
  end if;

  update public.free_consultation_requests fcr
  set
    consultation_text = v_text,
    image_1_path = v_p1,
    image_2_path = v_p2,
    image_3_path = v_p3
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id
    and r.patient_id = v_uid;

  perform public._patient_consultation_edit_finalize(p_request_id);
end;
$$;

revoke all on function public.patient_save_consultation_brief(uuid, text, text, text, text) from public;
grant execute on function public.patient_save_consultation_brief(uuid, text, text, text, text) to authenticated;
