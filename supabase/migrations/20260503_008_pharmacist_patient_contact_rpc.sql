-- Lecture nom / contact patient pour l’UI pharmacien sans dépendre du RLS « profiles »
-- (les politiques SELECT imbriquées peuvent empêcher l’affichage même avec 007).

create or replace function public.pharmacist_patient_contact_for_request(p_request_id uuid)
returns table (full_name text, whatsapp text, email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pid uuid;
begin
  if v_uid is null then
    return;
  end if;

  select r.patient_id
  into v_pid
  from public.requests r
  where r.id = p_request_id
    and exists (
      select 1
      from public.pharmacy_staff ps
      join public.profiles me on me.id = v_uid and me.role = 'pharmacien'
      where ps.user_id = v_uid
        and ps.pharmacy_id = r.pharmacy_id
    );

  if v_pid is null then
    return;
  end if;

  return query
  select p.full_name::text, p.whatsapp::text, p.email::text
  from public.profiles p
  where p.id = v_pid;
end;
$$;

revoke all on function public.pharmacist_patient_contact_for_request(uuid) from public;
grant execute on function public.pharmacist_patient_contact_for_request(uuid) to authenticated;

comment on function public.pharmacist_patient_contact_for_request(uuid) is
'Patient lié à la demande : nom, whatsapp, email — réservé au pharmacien staff de la pharmacie de la demande.';


create or replace function public.pharmacist_patient_directory_for_my_pharmacy()
returns table (patient_id uuid, full_name text, whatsapp text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (p.id)
    p.id as patient_id,
    p.full_name::text,
    p.whatsapp::text,
    p.email::text
  from public.profiles p
  join public.requests r on r.patient_id = p.id
  where exists (
    select 1
    from public.pharmacy_staff ps
    join public.profiles me on me.id = auth.uid() and me.role = 'pharmacien'
    where ps.user_id = auth.uid()
      and ps.pharmacy_id = r.pharmacy_id
  )
  order by p.id;
$$;

revoke all on function public.pharmacist_patient_directory_for_my_pharmacy() from public;
grant execute on function public.pharmacist_patient_directory_for_my_pharmacy() to authenticated;

comment on function public.pharmacist_patient_directory_for_my_pharmacy() is
'Patients ayant au moins une demande sur une pharmacie où l’utilisateur est staff pharmacien — pour listes / cartes.';
