-- Secure device-token registry for Firebase Cloud Messaging (Android app).
-- Run once in Supabase SQL Editor. Tokens are written through authenticated RPCs;
-- users cannot read another account's registered devices.

create table if not exists public.customer_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android','ios')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists customer_push_tokens_user_idx
  on public.customer_push_tokens(user_id, platform);

alter table public.customer_push_tokens enable row level security;
revoke all on public.customer_push_tokens from anon, authenticated;
grant select, insert, update, delete on public.customer_push_tokens to service_role;

create or replace function public.register_customer_push_token(
  p_token text,
  p_platform text default 'android'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := trim(coalesce(p_token, ''));
  v_platform text := lower(trim(coalesce(p_platform, 'android')));
begin
  if v_user_id is null then
    raise exception 'Please sign in before enabling notifications';
  end if;
  if char_length(v_token) < 32 or char_length(v_token) > 4096 then
    raise exception 'The push notification token is invalid';
  end if;
  if v_platform not in ('android','ios') then
    raise exception 'Unsupported push notification platform';
  end if;

  insert into public.customer_push_tokens(user_id, token, platform, updated_at, last_seen_at)
  values (v_user_id, v_token, v_platform, now(), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now(),
        last_seen_at = now();
end;
$$;

create or replace function public.unregister_customer_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from public.customer_push_tokens
  where token = trim(coalesce(p_token, ''))
    and user_id = auth.uid();
end;
$$;

revoke all on function public.register_customer_push_token(text,text) from public;
revoke all on function public.unregister_customer_push_token(text) from public;
grant execute on function public.register_customer_push_token(text,text) to authenticated;
grant execute on function public.unregister_customer_push_token(text) to authenticated;

notify pgrst, 'reload schema';


-- Extend the existing admin/customer notification event log for Firebase push.
alter table public.marketplace_notification_events
  add column if not exists push_status text not null default 'pending',
  add column if not exists push_error text;

alter table public.marketplace_notification_events
  drop constraint if exists marketplace_notification_events_event_type_check;

alter table public.marketplace_notification_events
  add constraint marketplace_notification_events_event_type_check
  check (event_type in ('order_placed','order_cancelled','return_requested','order_update'));

alter table public.marketplace_notification_events
  drop constraint if exists marketplace_notification_events_push_status_check;

alter table public.marketplace_notification_events
  add constraint marketplace_notification_events_push_status_check
  check (push_status in ('pending','sending','sent','failed','skipped'));

notify pgrst, 'reload schema';
