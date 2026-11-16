-- Private delivery log for order notifications (email + WhatsApp).
-- Run once in Supabase SQL Editor after order-lifecycle.sql.
create table if not exists public.marketplace_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('order_placed','order_cancelled','return_requested')),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  return_request_id uuid references public.marketplace_return_requests(id) on delete cascade,
  email_status text not null default 'pending'
    check (email_status in ('pending','sending','sent','failed')),
  whatsapp_status text not null default 'pending'
    check (whatsapp_status in ('pending','sending','sent','failed')),
  email_error text,
  whatsapp_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_notification_events_order_idx
  on public.marketplace_notification_events(order_id, created_at desc);

alter table public.marketplace_notification_events enable row level security;
revoke all on public.marketplace_notification_events from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update on public.marketplace_notification_events to service_role;

notify pgrst, 'reload schema';
