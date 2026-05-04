-- Fix notifications Q34:
-- 1) Une demande créée directement en status 'submitted' n'alimentait pas request_status_history.
-- 2) Le trigger de notifications lit request_status_history; donc aucune notif initiale pharmacien.
--
-- Cette migration:
-- - ajoute un trigger d'historisation à l'insert de requests,
-- - backfill les demandes déjà "submitted" sans historique.

create or replace function public._log_initial_request_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Historise uniquement les statuts "réels" de workflow.
  if new.status in ('submitted', 'in_review', 'responded', 'confirmed', 'completed', 'cancelled', 'abandoned', 'expired') then
    perform public._log_request_status_change(
      new.id,
      null,
      new.status,
      new.patient_id,
      'request_created_with_status'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_requests_initial_status_history on public.requests;
create trigger trg_requests_initial_status_history
after insert on public.requests
for each row
execute function public._log_initial_request_status_history();

-- Backfill ciblé: demandes déjà soumises sans aucun historique.
with missing as (
  select r.id, r.patient_id
  from public.requests r
  where r.status = 'submitted'
    and not exists (
      select 1 from public.request_status_history h where h.request_id = r.id
    )
)
insert into public.request_status_history (request_id, old_status, new_status, changed_by, reason)
select
  m.id,
  null,
  'submitted'::public.request_status_enum,
  m.patient_id,
  'backfill_missing_initial_history_submitted'
from missing m;

comment on function public._log_initial_request_status_history() is
'Historise le statut initial d une demande à l insert afin de déclencher les notifications in-app.';
