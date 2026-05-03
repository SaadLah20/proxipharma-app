-- Permet au pharmacien (membre pharmacy_staff) de lire le profil des patients
-- ayant au moins une demande sur la même pharmacie (nom, contact pour l’UI).

drop policy if exists "profiles_select_for_assigned_pharmacy_patients" on public.profiles;

create policy "profiles_select_for_assigned_pharmacy_patients"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.requests r
    join public.pharmacy_staff ps
      on ps.pharmacy_id = r.pharmacy_id
     and ps.user_id = auth.uid()
    where r.patient_id = profiles.id
  )
);

comment on policy "profiles_select_for_assigned_pharmacy_patients" on public.profiles is
'Lecture profil patient si une demande relie ce patient à une pharmacie où l’utilisateur est staff.';
