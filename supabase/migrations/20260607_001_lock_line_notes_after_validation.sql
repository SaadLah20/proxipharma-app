-- Notes par ligne figées après validation (confirmed+) : patient + pharmacien.
-- La conversation dossier (request_comments) reste ouverte.

create or replace function public.trg_lock_line_notes_when_request_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_status public.request_status_enum;
begin
  if tg_table_name = 'request_items' then
    v_request_id := coalesce(new.request_id, old.request_id);
  elsif tg_table_name = 'request_item_alternatives' then
    select ri.request_id
    into v_request_id
    from public.request_items ri
    where ri.id = coalesce(new.request_item_id, old.request_item_id);
  else
    return coalesce(new, old);
  end if;

  select r.status into v_status from public.requests r where r.id = v_request_id;

  if v_status in (
    'confirmed', 'treated', 'completed', 'partially_collected', 'fully_collected',
    'cancelled', 'abandoned', 'expired'
  ) and tg_op = 'UPDATE' then
    if tg_table_name = 'request_items' then
      new.client_comment := old.client_comment;
      new.pharmacist_comment := old.pharmacist_comment;
    elsif tg_table_name = 'request_item_alternatives' then
      new.pharmacist_comment := old.pharmacist_comment;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_request_items_lock_line_notes on public.request_items;
create trigger trg_request_items_lock_line_notes
  before update on public.request_items
  for each row
  execute function public.trg_lock_line_notes_when_request_locked();

drop trigger if exists trg_request_item_alternatives_lock_line_notes on public.request_item_alternatives;
create trigger trg_request_item_alternatives_lock_line_notes
  before update on public.request_item_alternatives
  for each row
  execute function public.trg_lock_line_notes_when_request_locked();

comment on function public.trg_lock_line_notes_when_request_locked() is
  'Figée client_comment / pharmacist_comment après confirmed (et statuts terminaux). INSERT non concerné (ajout officine post-validé).';
