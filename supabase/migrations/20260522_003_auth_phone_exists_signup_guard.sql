-- Vérification serveur : numéro déjà enregistré dans auth.users (inscription, pas énumération client directe).

create or replace function public.auth_phone_user_exists(p_phone text)
returns boolean
language sql
security definer
set search_path = auth, public
stable
as $$
  select exists (
    select 1
    from auth.users u
    where u.phone is not null
      and regexp_replace(u.phone, '^\+', '') = regexp_replace(nullif(trim(p_phone), ''), '^\+', '')
  );
$$;

revoke all on function public.auth_phone_user_exists(text) from public;
grant execute on function public.auth_phone_user_exists(text) to service_role;

comment on function public.auth_phone_user_exists(text) is
'True si auth.users contient déjà ce téléphone (E.164). Réservé service_role / API inscription.';
