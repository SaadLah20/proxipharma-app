-- Q34 (MVP) — notifications in-app sur transitions de statut de demande.
-- Dépend des tables requests / request_status_history / pharmacy_staff.

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  source_status_history_id uuid references public.request_status_history(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  title text not null check (char_length(title) between 3 and 160),
  body text,
  read_at timestamptz
);

create index if not exists app_notifications_recipient_created_idx
  on public.app_notifications (recipient_id, created_at desc);

create index if not exists app_notifications_request_idx
  on public.app_notifications (request_id);

create unique index if not exists app_notifications_unique_source_recipient_idx
  on public.app_notifications (source_status_history_id, recipient_id)
  where source_status_history_id is not null;

alter table public.app_notifications enable row level security;

drop policy if exists "app_notifications_select_own" on public.app_notifications;
create policy "app_notifications_select_own"
on public.app_notifications
for select
to authenticated
using (recipient_id = auth.uid() or public.is_admin());

drop policy if exists "app_notifications_update_read_own" on public.app_notifications;
create policy "app_notifications_update_read_own"
on public.app_notifications
for update
to authenticated
using (recipient_id = auth.uid() or public.is_admin())
with check (
  recipient_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "app_notifications_insert_admin_only" on public.app_notifications;
create policy "app_notifications_insert_admin_only"
on public.app_notifications
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "app_notifications_delete_admin_only" on public.app_notifications;
create policy "app_notifications_delete_admin_only"
on public.app_notifications
for delete
to authenticated
using (public.is_admin());

create or replace function public._request_status_notification_message(
  p_new_status public.request_status_enum
)
returns text
language plpgsql
immutable
as $$
begin
  case p_new_status
    when 'submitted' then return 'La demande est envoyée et attend le traitement de la pharmacie.';
    when 'in_review' then return 'La pharmacie a commencé le traitement de la demande.';
    when 'responded' then return 'La pharmacie a répondu. Valide ou modifie la demande.';
    when 'confirmed' then return 'Le patient a validé la sélection. Préparation/comptoir en cours.';
    when 'completed' then return 'La demande est clôturée.';
    when 'cancelled' then return 'La demande a été annulée.';
    when 'abandoned' then return 'La demande a été abandonnée.';
    when 'expired' then return 'La demande a expiré.';
    else return 'Le statut de la demande a été mis à jour.';
  end case;
end;
$$;

create or replace function public._request_status_notification_title(
  p_new_status public.request_status_enum
)
returns text
language plpgsql
immutable
as $$
begin
  case p_new_status
    when 'submitted' then return 'Nouvelle demande reçue';
    when 'in_review' then return 'Demande en traitement';
    when 'responded' then return 'Réponse de la pharmacie';
    when 'confirmed' then return 'Demande confirmée';
    when 'completed' then return 'Demande clôturée';
    when 'cancelled' then return 'Demande annulée';
    when 'abandoned' then return 'Demande abandonnée';
    when 'expired' then return 'Demande expirée';
    else return 'Mise à jour de demande';
  end case;
end;
$$;

create or replace function public._emit_in_app_notifications_for_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.requests%rowtype;
  v_title text;
  v_body text;
begin
  -- Notifications limitées aux transitions utiles pour le MVP.
  if new.new_status not in ('submitted', 'in_review', 'responded', 'confirmed', 'completed', 'cancelled', 'abandoned', 'expired') then
    return new;
  end if;

  select *
  into v_req
  from public.requests r
  where r.id = new.request_id;

  if not found then
    return new;
  end if;

  v_title := public._request_status_notification_title(new.new_status);
  v_body := public._request_status_notification_message(new.new_status);

  -- Patient: notifié sur les étapes qui l'impactent directement.
  if new.new_status in ('in_review', 'responded', 'completed', 'cancelled', 'abandoned', 'expired') then
    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    values (
      v_req.patient_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title,
      v_body
    )
    on conflict (source_status_history_id, recipient_id) do nothing;
  end if;

  -- Pharmaciens de l'officine: notifiés sur soumission et confirmation patient.
  if new.new_status in ('submitted', 'confirmed', 'abandoned', 'cancelled') then
    insert into public.app_notifications (
      recipient_id, request_id, source_status_history_id, event_type, title, body
    )
    select
      ps.user_id,
      new.request_id,
      new.id,
      'request_status:' || new.new_status::text,
      v_title,
      v_body
    from public.pharmacy_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.pharmacy_id = v_req.pharmacy_id
      and p.role = 'pharmacien'
    on conflict (source_status_history_id, recipient_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_request_status_history_in_app_notifications
  on public.request_status_history;

create trigger trg_request_status_history_in_app_notifications
after insert on public.request_status_history
for each row
execute function public._emit_in_app_notifications_for_status_history();

comment on table public.app_notifications is
'Notifications in-app (MVP Q34) générées automatiquement à partir des transitions de statut.';
