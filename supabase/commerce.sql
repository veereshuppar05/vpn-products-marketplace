-- Cart, delivery addresses and order requests for VPN Products and Services.
-- Run this file AFTER supabase/schema.sql in Supabase Dashboard > SQL Editor.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  address_line1 text not null check (char_length(trim(address_line1)) between 3 and 160),
  address_line2 text not null check (char_length(trim(address_line2)) between 2 and 160),
  landmark text,
  city text not null check (char_length(trim(city)) between 2 and 80),
  state text not null check (char_length(trim(state)) between 2 and 80),
  address_type text not null default 'Home' check (address_type in ('Home','Work','Other')),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_user_created_idx
  on public.customer_addresses(user_id, created_at desc);
create unique index if not exists customer_addresses_one_default_per_user_idx
  on public.customer_addresses(user_id) where is_default = true;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 160),
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object'),
  quantity smallint not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  unique(user_id, item_key)
);
create index if not exists cart_items_user_created_idx
  on public.cart_items(user_id, created_at desc);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  delivery_address jsonb not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation','confirmed','processing','shipped','delivered','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists marketplace_orders_buyer_created_idx
  on public.marketplace_orders(buyer_id, created_at desc);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  product_key text not null,
  product_title text not null,
  category text not null default '',
  condition text not null default '',
  unit_price numeric(12,2) not null check (unit_price > 0),
  quantity smallint not null default 1 check (quantity between 1 and 99),
  seller_name text not null default '',
  image_url text not null default '',
  manual_verification boolean not null default false
);
create index if not exists marketplace_order_items_order_idx
  on public.marketplace_order_items(order_id);

alter table public.customer_addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;

drop policy if exists "customers manage own addresses" on public.customer_addresses;
create policy "customers manage own addresses" on public.customer_addresses
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "customers manage own cart" on public.cart_items;
create policy "customers manage own cart" on public.cart_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "customers read own orders or admin" on public.marketplace_orders;
create policy "customers read own orders or admin" on public.marketplace_orders
for select to authenticated
using (buyer_id = auth.uid() or public.is_resell_admin());

drop policy if exists "customers read own order items or admin" on public.marketplace_order_items;
create policy "customers read own order items or admin" on public.marketplace_order_items
for select to authenticated
using (
  exists (
    select 1 from public.marketplace_orders o
    where o.id = marketplace_order_items.order_id
      and (o.buyer_id = auth.uid() or public.is_resell_admin())
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.marketplace_orders to authenticated;
grant select on public.marketplace_order_items to authenticated;

-- The customer submits an order request. It is NOT a payment or a confirmed sale.
-- UUID product IDs are checked against active database listings and their database
-- prices. The hard-coded featured Samsung product is stored as a request needing
-- seller verification because it is not currently a row in public.listings.
create or replace function public.create_marketplace_order(
  p_address_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_address jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_item_key text;
  v_listing_id uuid;
  v_title text;
  v_category text;
  v_condition text;
  v_seller_name text;
  v_image_url text;
  v_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_manual boolean;
begin
  if v_user_id is null then
    raise exception 'Please sign in before placing an order request';
  end if;

  select to_jsonb(a) - 'user_id'
    into v_address
  from public.customer_addresses a
  where a.id = p_address_id and a.user_id = v_user_id;

  if v_address is null then
    raise exception 'Select a saved delivery address or add a new one';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Your cart must contain a valid item list';
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Your cart must contain between 1 and 20 items';
  end if;

  -- Validate the full cart and calculate the total before creating any order.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_key := coalesce(v_item->>'id', '');
    if v_item_key = '' or char_length(v_item_key) > 160 then
      raise exception 'One cart item has an invalid product reference';
    end if;

    if v_item_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_listing_id := v_item_key::uuid;
      select l.title, l.category, l.condition, l.seller_name, l.price,
             coalesce(l.image_urls->>0, '')
        into v_title, v_category, v_condition, v_seller_name, v_price, v_image_url
      from public.listings l
      where l.id = v_listing_id and l.status = 'active' and l.seller_id <> v_user_id
      for update;
      if not found then
        raise exception 'A product in your cart is no longer available';
      end if;
    else
      -- Demo/sample product keys are accepted as order requests that require
      -- manual seller verification. No online payment is processed here.
      v_title := nullif(trim(v_item->>'title'), '');
      v_category := coalesce(v_item->>'category', '');
      v_condition := coalesce(v_item->>'condition', '');
      v_seller_name := coalesce(v_item->>'seller_name', '');
      v_image_url := coalesce(v_item->'image_urls'->>0, '');
      begin
        v_price := (v_item->>'price')::numeric(12,2);
      exception when others then
        raise exception 'A cart item has an invalid price';
      end;
      if v_title is null then
        raise exception 'A cart item is missing its product name';
      end if;
    end if;

    if v_price is null or v_price <= 0 then
      raise exception 'A cart item has an invalid price';
    end if;
    v_total := v_total + v_price;
  end loop;

  insert into public.marketplace_orders (buyer_id, delivery_address, subtotal, status)
  values (v_user_id, v_address, v_total, 'pending_confirmation')
  returning id into v_order_id;

  -- Save a product snapshot so the order remains readable even if a listing changes.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_key := v_item->>'id';
    v_manual := true;
    if v_item_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_listing_id := v_item_key::uuid;
      select l.title, l.category, l.condition, l.seller_name, l.price,
             coalesce(l.image_urls->>0, '')
        into v_title, v_category, v_condition, v_seller_name, v_price, v_image_url
      from public.listings l
      where l.id = v_listing_id and l.status = 'active' and l.seller_id <> v_user_id;
      v_manual := false;
    else
      v_title := trim(v_item->>'title');
      v_category := coalesce(v_item->>'category', '');
      v_condition := coalesce(v_item->>'condition', '');
      v_seller_name := coalesce(v_item->>'seller_name', '');
      v_image_url := coalesce(v_item->'image_urls'->>0, '');
      v_price := (v_item->>'price')::numeric(12,2);
    end if;

    insert into public.marketplace_order_items (
      order_id, product_key, product_title, category, condition,
      unit_price, quantity, seller_name, image_url, manual_verification
    ) values (
      v_order_id, v_item_key, v_title, v_category, v_condition,
      v_price, 1, v_seller_name, v_image_url, v_manual
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_marketplace_order(uuid, jsonb) from public;
grant execute on function public.create_marketplace_order(uuid, jsonb) to authenticated;

NOTIFY pgrst, 'reload schema';
