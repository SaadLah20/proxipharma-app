-- Q35 — Notifications hors-app : préférences utilisateur + file pour email / SMS / WhatsApp.
-- Les envois réels (SMTP, Twilio, WhatsApp Cloud API, etc.) sont hors périmètre SQL ;
-- un worker (Edge Function, cron service_role) lit notification_external_queue où status = pending.
--
-- Comportement :
-- - Sans ligne dans notification_external_prefs : aucun enqueue (opt-in explicite pour le pilote MA).
-- Après insert sur app_notifications : pour chaque canal activé avec une destination renseignée sur profiles,
--   une ligne pending est insérée (snapshot du destinataire dans destination_snapshot).

do $$
begin
  create type public.notification_external_channel_enum as enum ('email', 'sms', 'whatsapp');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.notification_external_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  email_enabled boolean not null default false,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false
);

drop trigger if exists trg_notification_external_prefs_updated_at on public.notification_external_prefs;
create trigger trg_notification_external_prefs_updated_at
before update on public.notification_external_prefs
for each row
execute function public.set_updated_at();

create table if not exists public.notification_external_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid not null references public.requests (id) on delete cascade,
  app_notification_id uuid not null references public.app_notifications (id) on delete cascade,
  channel public.notification_external_channel_enum not null,
  event_type text not null check (char_length(event_type) between 3 and 120),
  title text not null check (char_length(title) between 3 and 200),
  body text,
  destination_snapshot text not null check (char_length(trim(destination_snapshot)) >= 3),
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);

create unique index if not exists notification_external_queue_app_notif_channel_uidx
  on public.notification_external_queue (app_notification_id, channel);

create index if not exists notification_external_queue_status_created_idx
  on public.notification_external_queue (status, created_at asc);

create index if not exists notification_external_queue_recipient_created_idx
  on public.notification_external_queue (recipient_id, created_at desc);

comment on table public.notification_external_prefs is
'Opt-in canaux externes (Q35). Absence de ligne = tout désactivé.';

comment on table public.notification_external_queue is
'File de sortie pour relayer les app_notifications vers email/SMS/WhatsApp ; traitée par worker service_role.';

-- RLS
alter table public.notification_external_prefs enable row level security;
alter table public.notification_external_queue enable row level security;

drop policy if exists "notification_external_prefs_select" on public.notification_external_prefs;
create policy "notification_external_prefs_select"
on public.notification_external_prefs
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "notification_external_prefs_insert_own" on public.notification_external_prefs;
create policy "notification_external_prefs_insert_own"
on public.notification_external_prefs
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notification_external_prefs_update_own" on public.notification_external_prefs;
create policy "notification_external_prefs_update_own"
on public.notification_external_prefs
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "notification_external_queue_admin_all" on public.notification_external_queue;
create policy "notification_external_queue_admin_all"
on public.notification_external_queue
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public._enqueue_external_notifications_from_app_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.notification_external_prefs%rowtype;
  v_email text;
  v_wa text;
  v_phone text;
begin
  select p.email, p.whatsapp
  into v_email, v_wa
  from public.profiles p
  where p.id = new.recipient_id;

  select *
  into v_prefs
  from public.notification_external_prefs pref
  where pref.user_id = new.recipient_id;

  if not found then
    return new;
  end if;

  v_email := nullif(trim(both from coalesce(v_email, '')), '');
  v_wa := nullif(trim(both from coalesce(v_wa, '')), '');
  v_phone := v_wa;

  if v_prefs.email_enabled and v_email is not null then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'email'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_email
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.sms_enabled and v_phone is not null then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'sms'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  if v_prefs.whatsapp_enabled and v_phone is not null then
    insert into public.notification_external_queue (
      recipient_id,
      request_id,
      app_notification_id,
      channel,
      event_type,
      title,
      body,
      destination_snapshot
    )
    values (
      new.recipient_id,
      new.request_id,
      new.id,
      'whatsapp'::public.notification_external_channel_enum,
      new.event_type,
      new.title,
      new.body,
      v_phone
    )
    on conflict (app_notification_id, channel) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_app_notifications_enqueue_external on public.app_notifications;

create trigger trg_app_notifications_enqueue_external
after insert on public.app_notifications
for each row
execute function public._enqueue_external_notifications_from_app_row();

comment on function public._enqueue_external_notifications_from_app_row() is
'Alimente notification_external_queue lorsque les préférences externes et profiles email/whatsapp sont renseignés.';
