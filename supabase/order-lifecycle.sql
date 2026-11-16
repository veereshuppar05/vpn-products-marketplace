-- Customer order cancellation, return requests and tracking fields.
-- Run AFTER shipping-integration.sql and prepaid-only.sql.

alter table public.marketplace_orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists tracking_payload jsonb,
  add column if not exists tracking_updated_at timestamptz;

create table if not exists public.marketplace_return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.marketplace_orders(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 3 and 80),
  details text not null default '' check (char_length(details) <= 1200),
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','pickup_scheduled','picked_up','in_transit','received','cancelled')),
  admin_note text,
  shiprocket_return_order_id bigint,
  shiprocket_return_shipment_id bigint,
  return_awb text,
  return_tracking_url text,
  return_shipping_status text not null default 'not_booked',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_return_requests_buyer_created_idx
  on public.marketplace_return_requests(buyer_id, created_at desc);
create index if not exists marketplace_return_requests_status_created_idx
  on public.marketplace_return_requests(status, created_at desc);

alter table public.marketplace_return_requests enable row level security;

drop policy if exists "buyers read own return requests or admin" on public.marketplace_return_requests;
create policy "buyers read own return requests or admin"
  on public.marketplace_return_requests
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_resell_admin());

grant select on public.marketplace_return_requests to authenticated;
revoke insert, update, delete on public.marketplace_return_requests from anon, authenticated;

create or replace function public.create_marketplace_return_request(
  p_order_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.marketplace_orders%rowtype;
  v_return_id uuid;
begin
  if v_user_id is null then
    raise exception 'Please sign in before requesting a return';
  end if;

  select * into v_order
  from public.marketplace_orders
  where id = p_order_id and buyer_id = v_user_id;

  if not found then
    raise exception 'Order was not found';
  end if;

  if coalesce(v_order.is_test_order, false) then
    raise exception 'Test orders cannot be returned or shipped';
  end if;

  if coalesce(v_order.payment_method, 'prepaid') <> 'prepaid' or coalesce(v_order.payment_status, 'pending') <> 'paid' then
    raise exception 'A return can be requested only for an order whose prepaid payment has been received and verified';
  end if;

  if v_order.status <> 'delivered' and lower(coalesce(v_order.shipping_status, '')) <> 'delivered' then
    raise exception 'A return can be requested only after delivery is confirmed';
  end if;

  if char_length(trim(coalesce(p_reason,''))) < 3 or char_length(trim(coalesce(p_reason,''))) > 80 then
    raise exception 'Select a valid return reason';
  end if;

  if char_length(coalesce(p_details,'')) > 1200 then
    raise exception 'Return details must be 1200 characters or fewer';
  end if;

  insert into public.marketplace_return_requests(order_id,buyer_id,reason,details)
  values (p_order_id,v_user_id,trim(p_reason),trim(coalesce(p_details,'')))
  returning id into v_return_id;

  return v_return_id;
exception
  when unique_violation then
    raise exception 'A return request already exists for this order';
end;
$$;

revoke all on function public.create_marketplace_return_request(uuid,text,text) from public;
grant execute on function public.create_marketplace_return_request(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
