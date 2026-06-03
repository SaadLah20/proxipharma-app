-- Résolution user id depuis auth.users.phone (connexion par téléphone, sync-phone-login).

create or replace function public.auth_phone_lookup_user_id(p_phone text)
returns uuid
language sql
security definer
set search_path = auth, public
stable
as $$
  select u.id
  from auth.users u
  where u.phone is not null
    and regexp_replace(u.phone, '^\+', '') = regexp_replace(nullif(trim(p_phone), ''), '^\+', '')
  limit 1;
$$;

revoke all on function public.auth_phone_lookup_user_id(text) from public;
grant execute on function public.auth_phone_lookup_user_id(text) to service_role;

comment on function public.auth_phone_lookup_user_id(text) is
'UUID auth.users pour ce téléphone E.164 (chiffres comparés sans le +). Réservé service_role.';
