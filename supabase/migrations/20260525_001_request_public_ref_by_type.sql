-- Références publiques par type de demande : D / O / C avec compteurs séparés par officine et année.

alter table public.pharmacy_request_ref_counters
  add column if not exists request_type public.request_type_enum;

update public.pharmacy_request_ref_counters
set request_type = 'product_request'::public.request_type_enum
where request_type is null;

alter table public.pharmacy_request_ref_counters
  alter column request_type set not null;

alter table public.pharmacy_request_ref_counters
  drop constraint if exists pharmacy_request_ref_counters_pkey;

alter table public.pharmacy_request_ref_counters
  add primary key (pharmacy_id, yr, request_type);

create or replace function public.trg_assign_request_public_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz timestamptz;
  v_yr int;
  v_n int;
  v_prefix text;
begin
  if new.request_public_ref is not null and btrim(new.request_public_ref) <> '' then
    return new;
  end if;

  v_prefix := case new.request_type
    when 'prescription' then 'O'
    when 'free_consultation' then 'C'
    else 'D'
  end;

  v_tz := coalesce(new.created_at, new.submitted_at, clock_timestamp());
  v_yr := extract(year from timezone('Africa/Casablanca', v_tz))::int;

  insert into public.pharmacy_request_ref_counters (pharmacy_id, yr, request_type, last_n)
  values (new.pharmacy_id, v_yr, new.request_type, 1)
  on conflict (pharmacy_id, yr, request_type)
  do update set last_n = public.pharmacy_request_ref_counters.last_n + 1
  returning last_n into strict v_n;

  new.request_ref_year := v_yr;
  new.request_ref_seq := v_n;
  new.request_public_ref := format(
    '%s%s/%s',
    v_prefix,
    lpad(v_n::text, 3, '0'),
    lpad((v_yr % 100)::text, 2, '0')
  );
  return new;
end;
$$;

comment on table public.pharmacy_request_ref_counters is
  'Dernier rang request_public_ref par pharmacie, année (fuseau Casablanca) et type de demande.';
