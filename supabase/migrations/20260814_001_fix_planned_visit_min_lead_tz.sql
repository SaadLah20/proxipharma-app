-- Fix délai 30 min passage : comparer deux timestamptz (now() + 30 min),
-- pas un timestamptz vs timestamp naïf Casablanca (interprété en UTC sur Supabase).

create or replace function public._assert_pharmacy_open_for_visit(
  p_pharmacy_id uuid,
  p_date date,
  p_time time
)
returns void
language plpgsql
stable
as $$
declare
  v_today date;
  v_visit timestamptz;
  v_minutes int;
  v_holiday_label text;
begin
  if p_pharmacy_id is null then
    return;
  end if;

  v_today := (timezone('Africa/Casablanca', now()))::date;

  if not public._pharmacy_day_has_open_slot(p_pharmacy_id, p_date) then
    select h.label_fr into v_holiday_label
    from public.morocco_public_holidays h
    where h.date = p_date;

    if v_holiday_label is not null then
      raise exception 'Cette officine est fermée ce jour-là (%). Choisissez une autre date.', v_holiday_label;
    end if;

    raise exception 'Cette officine est fermée ce jour-là. Choisissez une autre date.';
  end if;

  if p_time is null then
    return;
  end if;

  v_minutes := public._time_to_minutes(p_time);
  v_visit := public._visit_timestamptz_casablanca(p_date, v_minutes);

  if p_date = v_today and v_visit < now() + interval '30 minutes' then
    raise exception 'Choisissez une heure au moins 30 minutes à partir de maintenant.';
  end if;

  if not public._pharmacy_is_open_at_minute(p_pharmacy_id, p_date, v_minutes) then
    raise exception 'Cette officine est fermée à cette heure. Consultez les horaires de l''officine.';
  end if;
end;
$$;
