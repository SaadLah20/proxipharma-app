-- Avis publics sur les officines (1 note par compte auteur).

create table if not exists public.pharmacy_ratings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  unique (pharmacy_id, author_id)
);

create index if not exists pharmacy_ratings_pharmacy_idx on public.pharmacy_ratings (pharmacy_id);
create index if not exists pharmacy_ratings_author_idx on public.pharmacy_ratings (author_id);

create or replace function public.refresh_pharmacy_rating_aggregate(p_pharmacy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric(3, 2);
  v_count integer;
begin
  select coalesce(round(avg(score)::numeric, 2), 0), count(*)::integer
  into v_avg, v_count
  from public.pharmacy_ratings
  where pharmacy_id = p_pharmacy_id;

  update public.pharmacies
  set rating_avg = v_avg, rating_count = v_count
  where id = p_pharmacy_id;
end;
$$;

create or replace function public.trg_pharmacy_ratings_refresh_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_pharmacy_rating_aggregate(coalesce(new.pharmacy_id, old.pharmacy_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists pharmacy_ratings_refresh_aggregate on public.pharmacy_ratings;
create trigger pharmacy_ratings_refresh_aggregate
  after insert or update or delete on public.pharmacy_ratings
  for each row
  execute function public.trg_pharmacy_ratings_refresh_aggregate();

create or replace function public.submit_pharmacy_rating(
  p_pharmacy_id uuid,
  p_score smallint,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_comment text := nullif(trim(p_comment), '');
begin
  if v_uid is null then
    raise exception 'Connexion requise pour noter une pharmacie.';
  end if;

  if p_score is null or p_score < 1 or p_score > 5 then
    raise exception 'Choisissez une note entre 1 et 5 étoiles.';
  end if;

  if v_comment is not null and char_length(v_comment) > 500 then
    raise exception 'Commentaire trop long (500 caractères max.).';
  end if;

  if not exists (select 1 from public.pharmacies where id = p_pharmacy_id) then
    raise exception 'Pharmacie introuvable.';
  end if;

  if exists (
    select 1 from public.pharmacy_staff ps
    where ps.pharmacy_id = p_pharmacy_id and ps.user_id = v_uid
  ) then
    raise exception 'Les membres de l''officine ne peuvent pas noter leur propre pharmacie.';
  end if;

  insert into public.pharmacy_ratings (pharmacy_id, author_id, score, comment)
  values (p_pharmacy_id, v_uid, p_score, v_comment)
  on conflict (pharmacy_id, author_id)
  do update set
    score = excluded.score,
    comment = excluded.comment,
    updated_at = now();
end;
$$;

revoke all on function public.submit_pharmacy_rating(uuid, smallint, text) from public;
grant execute on function public.submit_pharmacy_rating(uuid, smallint, text) to authenticated;

alter table public.pharmacy_ratings enable row level security;

drop policy if exists "pharmacy_ratings_select_public" on public.pharmacy_ratings;
create policy "pharmacy_ratings_select_public"
  on public.pharmacy_ratings for select to anon, authenticated using (true);

drop policy if exists "pharmacy_ratings_insert_own" on public.pharmacy_ratings;
create policy "pharmacy_ratings_insert_own"
  on public.pharmacy_ratings for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists "pharmacy_ratings_update_own" on public.pharmacy_ratings;
create policy "pharmacy_ratings_update_own"
  on public.pharmacy_ratings for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "pharmacy_ratings_delete_own" on public.pharmacy_ratings;
create policy "pharmacy_ratings_delete_own"
  on public.pharmacy_ratings for delete to authenticated
  using (author_id = auth.uid());

grant select on public.pharmacy_ratings to anon, authenticated;
grant insert, update, delete on public.pharmacy_ratings to authenticated;

comment on table public.pharmacy_ratings is 'Une note par utilisateur et par officine ; agrégat sur pharmacies.rating_avg / rating_count.';
