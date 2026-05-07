-- Pharmacien : annulation totale d'une demande, avec motif obligatoire.
--
-- Contrat :
-- - Pharmacien rattaché à la pharmacie de la demande (pharmacy_staff)
-- - Statuts éligibles : submitted, in_review, responded, confirmed
-- - Statut cible : cancelled (mêmes implications côté patient/dashboard)
-- - Motif libre obligatoire (>= 5 caractères, <= 2000)
-- - Trace history : reason `pharmacist_cancel|<motif>` (préfixe stable pour parsing UI)

create or replace function public.pharmacist_cancel_request(
  p_request_id uuid,
  p_reason_text text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.request_status_enum;
  v_pharmacy uuid;
  v_type public.request_type_enum;
  v_reason text := nullif(trim(p_reason_text), '');
  v_is_staff boolean := false;
  v_log text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Motif d''annulation obligatoire (5 caractères minimum).';
  end if;

  if length(v_reason) > 2000 then
    raise exception 'Motif d''annulation trop long.';
  end if;

  select status, pharmacy_id, request_type
  into v_old, v_pharmacy, v_type
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_type <> 'product_request' then
    raise exception 'Only product_request';
  end if;

  if v_old not in ('submitted', 'in_review', 'responded', 'confirmed') then
    raise exception 'Cannot cancel from status %', v_old;
  end if;

  select exists(
    select 1
    from public.pharmacy_staff ps
    where ps.user_id = v_uid
      and ps.pharmacy_id = v_pharmacy
  )
  into v_is_staff;

  if not v_is_staff then
    raise exception 'Forbidden';
  end if;

  v_log := format('pharmacist_cancel|%s', v_reason);

  update public.requests
  set
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  where id = p_request_id;

  perform public._log_request_status_change(p_request_id, v_old, 'cancelled', v_uid, v_log);
end;
$$;

comment on function public.pharmacist_cancel_request(uuid, text) is
'Annulation totale par le pharmacien (submitted/in_review/responded/confirmed -> cancelled), motif obligatoire.';

revoke all on function public.pharmacist_cancel_request(uuid, text) from public;
grant execute on function public.pharmacist_cancel_request(uuid, text) to authenticated;
