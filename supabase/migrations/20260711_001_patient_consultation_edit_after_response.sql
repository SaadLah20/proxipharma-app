-- Consultation libre : édition patient après réponse pharmacien (responded) + horodatage modification.

alter table public.free_consultation_requests
  add column if not exists patient_content_updated_at timestamptz;

comment on column public.free_consultation_requests.patient_content_updated_at is
  'Dernière modification patient du texte ou des photos (null si jamais modifié après envoi initial).';

create or replace function public._patient_can_edit_consultation_before_response(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in (
        'submitted'::public.request_status_enum,
        'in_review'::public.request_status_enum,
        'responded'::public.request_status_enum
      )
  );
$$;

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

revoke all on function public._patient_consultation_edit_finalize(uuid) from public;
grant execute on function public._patient_consultation_edit_finalize(uuid) to authenticated;

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

  update public.free_consultation_requests fcr
  set consultation_text = v_text
  from public.requests r
  where fcr.request_id = p_request_id
    and r.id = fcr.request_id;

  if not found then
    raise exception 'Consultation introuvable.';
  end if;

  perform public._patient_consultation_edit_finalize(p_request_id);
end;
$$;

create or replace function public.patient_attach_consultation_images(
  p_request_id uuid,
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
  v_p1 text := nullif(trim(p_image_1_path), '');
  v_p2 text := nullif(trim(p_image_2_path), '');
  v_p3 text := nullif(trim(p_image_3_path), '');
  v_prefix text := 'consultations/' || p_request_id::text || '/';
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

  if not found then
    raise exception 'Consultation introuvable ou accès refusé.';
  end if;

  perform public._patient_consultation_edit_finalize(p_request_id);
end;
$$;

create or replace function public.storage_patient_can_write_private_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select public.storage_is_valid_private_media_path(p_name)
    and exists (
      select 1
      from public.requests r
      where r.id = public.storage_request_id_from_private_path(p_name)
        and r.patient_id = auth.uid()
        and (
          (
            r.request_type = 'prescription'::public.request_type_enum
            and r.status in ('draft', 'submitted', 'in_review')
            and (storage.foldername(p_name))[1] in ('ordonnances', 'patient')
          )
          or (
            r.request_type = 'free_consultation'::public.request_type_enum
            and r.status in ('submitted', 'in_review', 'responded')
            and (storage.foldername(p_name))[1] = 'consultations'
          )
        )
    );
$$;

drop policy if exists "free_consultation_requests_update_patient" on public.free_consultation_requests;
create policy "free_consultation_requests_update_patient"
on public.free_consultation_requests
for update
to authenticated
using (
  exists (
    select 1 from public.requests r
    where r.id = free_consultation_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in ('submitted', 'in_review', 'responded')
  )
)
with check (
  exists (
    select 1 from public.requests r
    where r.id = free_consultation_requests.request_id
      and r.patient_id = auth.uid()
      and r.request_type = 'free_consultation'::public.request_type_enum
      and r.status in ('submitted', 'in_review', 'responded')
  )
);

-- Notif pharmacien (même motif que ordonnance mise à jour).
create or replace function public._in_app_notification_pharmacist(
  p_status public.request_status_enum,
  p_old_status public.request_status_enum,
  p_pharma_nom text,
  p_pharma_ville text,
  p_patient_nom text,
  p_nature text,
  p_when_fr text,
  p_history_reason text default null
)
returns table (n_title text, n_body text)
language plpgsql
stable
as $$
declare
  v_is_update_submitted boolean := false;
begin
  if p_history_reason = 'patient_prescription_updated' then
    n_title := 'Ordonnance mise à jour';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié le scan ou une précision sur son '
      || lower(coalesce(p_nature, 'ordonnance'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'patient_consultation_updated' then
    n_title := 'Consultation mise à jour';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié son message ou ses photos sur sa '
      || lower(coalesce(p_nature, 'consultation libre'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  if p_history_reason = 'patient_planned_visit_updated' then
    n_title := 'Passage patient modifié';
    n_body :=
      coalesce(p_patient_nom, 'Un patient')
      || ' a modifié sa date de passage sur sa '
      || lower(coalesce(p_nature, 'demande'))
      || '.'
      || E'\n'
      || p_when_fr;
    return next;
    return;
  end if;

  v_is_update_submitted :=
    p_status = 'submitted'
    and p_old_status is not null
    and p_old_status <> 'draft';

  n_title :=
    case p_status
      when 'submitted' then
        case when v_is_update_submitted then 'Demande mise à jour' else 'Nouvelle demande' end
      when 'confirmed' then 'Demande validée par le patient'
      when 'treated' then 'Demande marquée traitée'
      when 'completed' then 'Dossier clôturé au comptoir'
      when 'cancelled' then 'Demande annulée'
      when 'abandoned' then 'Demande abandonnée'
      when 'expired' then 'Demande expirée'
      else 'Mise à jour dossier'
    end;

  n_body :=
    case p_status
      when 'submitted' then
        case
          when v_is_update_submitted then
            coalesce(p_patient_nom, 'Un patient')
            || ' a renvoyé ou modifié sa '
            || lower(coalesce(p_nature, 'demande'))
            || '.'
          else
            coalesce(p_patient_nom, 'Un patient')
            || ' — '
            || coalesce(p_nature, 'Demande')
            || ' à traiter.'
        end
      when 'confirmed' then
        coalesce(p_patient_nom, 'Un patient')
        || ' a validé sa '
        || lower(coalesce(p_nature, 'demande'))
        || '. Préparez les produits retenus.'
      when 'treated' then
        'La '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' est prête pour le comptoir.'
      when 'completed' then
        'Le dossier '
        || lower(coalesce(p_nature, 'demande'))
        || ' de '
        || coalesce(p_patient_nom, 'un patient')
        || ' a été clôturé après passage.'
      when 'cancelled' then
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été annulée.'
      when 'abandoned' then
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a été abandonnée.'
      when 'expired' then
        'Une '
        || lower(coalesce(p_nature, 'demande'))
        || ' a expiré faute de validation patient.'
      else
        coalesce(p_patient_nom, '—') || ' — ' || coalesce(p_nature, 'demande')
    end
    || E'\n'
    || p_when_fr;

  return next;
end;
$$;

-- Patch émission : bloc patient_consultation_updated (copie patient_prescription_updated).
do $patch$
declare
  v_src text;
  v_needle text := $needle$  IF new.reason = 'patient_prescription_updated' THEN$needle$;
  v_block text := $block$
  IF new.reason = 'patient_consultation_updated' THEN
    SELECT t.n_title, t.n_body INTO v_title_ph, v_body_ph
    FROM public._in_app_notification_pharmacist(
      new.new_status, new.old_status, v_pharma_nom, v_pharma_ville, v_patient_nom, v_nature, v_when_fr, new.reason
    ) AS t;
    IF v_dossier_ref IS NOT NULL THEN
      v_body_ph := v_body_ph || E'\nRéf. dossier ' || v_dossier_ref;
    END IF;
    INSERT INTO public.app_notifications (recipient_id, request_id, source_status_history_id, event_type, title, body)
    SELECT ps.user_id, new.request_id, new.id, 'request_status:patient_consultation_updated', v_title_ph, v_body_ph
    FROM public.pharmacy_staff ps
    JOIN public.profiles p ON p.id = ps.user_id
    WHERE ps.pharmacy_id = v_req.pharmacy_id AND p.role = 'pharmacien'
      AND (new.changed_by IS NULL OR ps.user_id IS DISTINCT FROM new.changed_by)
    ON CONFLICT (source_status_history_id, recipient_id) DO NOTHING;
    RETURN new;
  END IF;
$block$;
begin
  select pg_get_functiondef('public._emit_in_app_notifications_for_status_history()'::regprocedure)
  into v_src;

  if v_src is null then
    raise exception 'Fonction _emit_in_app_notifications_for_status_history introuvable';
  end if;

  if v_src not like '%patient_consultation_updated%' then
    v_src := replace(v_src, v_needle, v_block || chr(10) || '  ' || v_needle);
    execute v_src;
  end if;
end;
$patch$;
