-- Fix PostgreSQL ON CONFLICT target for app_notifications
-- Root cause:
-- - function _emit_in_app_notifications_for_status_history() uses
--   ON CONFLICT (source_status_history_id, recipient_id)
-- - previous index was partial, which cannot be inferred by this ON CONFLICT form.

drop index if exists public.app_notifications_unique_source_recipient_idx;

create unique index if not exists app_notifications_unique_source_recipient_idx
  on public.app_notifications (source_status_history_id, recipient_id);

comment on index public.app_notifications_unique_source_recipient_idx is
'Unique pair for deduplicating status-history notifications per recipient.';
