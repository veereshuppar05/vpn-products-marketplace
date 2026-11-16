-- Shiprocket shipping quotes and order-level delivery metadata.
-- Run AFTER commerce.sql, cart-quantity.sql and address-district.sql.
-- The quote rows can only be created by the server-side Edge Function.
-- No Shiprocket credentials belong in this SQL file or the browser application.

alter table public.listings
  add column if not exists package_weight_kg numeric(8,3),
  add column if not exists package_length_cm numeric(8,2),
  add column if not exists package_breadth_cm numeric(8,2),
  add column if not exists package_height_cm numeric(8,2),
  add column if not exists is_test_product boolean not null default false;

alter table public.marketplace_order_items
  add column if not exists is_test_product boolean not null default false;

alter table public.marketplace_orders
  add column if not exists delivery_fee numeric(12,2) not null default 0,
  add column if not exists shipping_provider text not null default 'manual',
  add column if not exists shipping_quote_id uuid,
  add column if not exists shipping_courier_id integer,
  add column if not exists shipping_courier_name text,
  add column if not exists shipping_eta text,
  add column if not exists shipping_package jsonb,
  add column if not exists shipping_status text not null default 'not_booked',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists shiprocket_order_id bigint,
  add column if not exists shiprocket_shipment_id bigint,
  add column if not exists shipping_awb text,
  add column if not exists shipping_tracking_url text,
  add column if not exists shipping_label_url text,
  add column if not exists shipping_manifest_url text,
  add column if not exists shipping_error text,
  add column if not exists is_test_order boolean not null default false;

create table if not exists public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pickup_postcode text not null check (pickup_postcode ~ '^[0-9]{6}$'),
  delivery_postcode text not null check (delivery_postcode ~ '^[0-9]{6}$'),
  package_details jsonb not null check (jsonb_typeof(package_details) = 'object'),
  declared_value numeric(12,2) not null check (declared_value >= 0),
  couriers jsonb not null check (jsonb_typeof(couriers) = 'array'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists shipping_quotes_user_created_idx
  on public.shipping_quotes(user_id, created_at desc);

alter table public.shipping_quotes enable row level security;
drop policy if exists "customers read own shipping quotes" on public.shipping_quotes;
create policy "customers read own shipping quotes" on public.shipping_quotes
  for select to authenticated using (user_id = auth.uid());
grant select on public.shipping_quotes to authenticated;
revoke insert, update, delete on public.shipping_quotes from anon, authenticated;

-- The Shiprocket Edge Function writes quote rows with the server-only service role.
-- Keep write access unavailable to browser roles while allowing server-side inserts.
grant usage on schema public to service_role;
grant select, insert on public.shipping_quotes to service_role;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_orders_shipping_quote_id_fkey'
      and conrelid = 'public.marketplace_orders'::regclass
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_shipping_quote_id_fkey
      foreign key (shipping_quote_id) references public.shipping_quotes(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_orders_delivery_fee_check'
      and conrelid = 'public.marketplace_orders'::regclass
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_delivery_fee_check check (delivery_fee >= 0);
  end if;
end $$;

drop function if exists public.create_marketplace_order(uuid, jsonb);
drop function if exists public.create_marketplace_order(uuid, jsonb, uuid, integer);

create function public.create_marketplace_order(
  p_address_id uuid,
  p_items jsonb,
  p_shipping_quote_id uuid,
  p_courier_id integer
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
  v_quantity integer := 1;
  v_total numeric(12,2) := 0;
  v_manual boolean;
  v_is_test_product boolean := false;
  v_courier jsonb;
  v_delivery_fee numeric(12,2);
  v_shipping_package jsonb;
  v_shipping_eta text;
  v_is_test_order boolean := false;
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
    raise exception 'Your cart must contain between 1 and 20 products';
  end if;

  -- Validate quantities and calculate the order total before creating the order.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := coalesce(nullif(v_item->>'quantity','')::integer,1);
    exception when others then
      raise exception 'A cart item has an invalid quantity';
    end;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Each product quantity must be between 1 and 99';
    end if;

    v_item_key := coalesce(v_item->>'id', '');
    if v_item_key = '' or char_length(v_item_key) > 160 then
      raise exception 'One cart item has an invalid product reference';
    end if;

    if v_item_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_listing_id := v_item_key::uuid;
      select l.title, l.category, l.condition, l.seller_name, l.price,
             coalesce(l.image_urls->>0, ''), l.is_test_product
        into v_title, v_category, v_condition, v_seller_name, v_price, v_image_url, v_is_test_product
      from public.listings l
      where l.id = v_listing_id and l.status = 'active' and l.seller_id <> v_user_id
      for update;
      v_is_test_order := v_is_test_order or v_is_test_product;
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
    v_total := v_total + (v_price * v_quantity);
  end loop;

  if v_is_test_order and exists (
    select 1
    from jsonb_array_elements(p_items) item
    where not exists (
      select 1 from public.listings l
      where l.id = (item->>'id')::uuid
        and l.is_test_product = true
        and l.status = 'active'
    )
  ) then
    raise exception 'The ₹1 test listing must be checked out by itself, not mixed with normal products.';
  end if;

  -- Validate the courier choice against a recent server-generated Shiprocket quote.
  select courier.value, (courier.value->>'rate')::numeric(12,2), q.package_details
    into v_courier, v_delivery_fee, v_shipping_package
  from public.shipping_quotes q
  cross join lateral jsonb_array_elements(q.couriers) as courier(value)
  where q.id = p_shipping_quote_id
    and q.user_id = v_user_id
    and q.expires_at > now()
    and q.delivery_postcode = v_address->>'pincode'
    and abs(q.declared_value - v_total) < 0.01
    and (courier.value->>'courier_id')::integer = p_courier_id
  limit 1;

  if v_courier is null or v_delivery_fee is null then
    raise exception 'Your courier quote has expired or does not match this order. Check delivery options again.';
  end if;

  v_shipping_eta := coalesce(
    nullif(v_courier->>'etd',''),
    case when nullif(v_courier->>'estimated_delivery_days','') is not null
      then (v_courier->>'estimated_delivery_days') || ' days' else null end
  );

  insert into public.marketplace_orders (
    buyer_id, delivery_address, subtotal, delivery_fee, status,
    shipping_provider, shipping_quote_id, shipping_courier_id,
    shipping_courier_name, shipping_eta, shipping_package,
    shipping_status, payment_status, is_test_order
  ) values (
    v_user_id, v_address, v_total, v_delivery_fee, 'pending_confirmation',
    'shiprocket', p_shipping_quote_id, p_courier_id,
    v_courier->>'courier_name', v_shipping_eta, v_shipping_package,
    'quote_selected', 'pending', v_is_test_order
  )
  returning id into v_order_id;

  -- Save a product snapshot and the selected quantity on each order line.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := coalesce(nullif(v_item->>'quantity','')::integer,1);
    exception when others then
      raise exception 'A cart item has an invalid quantity';
    end;
    v_item_key := v_item->>'id';
    v_manual := true;
    v_is_test_product := false;
    if v_item_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_listing_id := v_item_key::uuid;
      select l.title, l.category, l.condition, l.seller_name, l.price,
             coalesce(l.image_urls->>0, ''), l.is_test_product
        into v_title, v_category, v_condition, v_seller_name, v_price, v_image_url, v_is_test_product
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
      unit_price, quantity, seller_name, image_url, manual_verification, is_test_product
    ) values (
      v_order_id, v_item_key, v_title, v_category, v_condition,
      v_price, v_quantity, v_seller_name, v_image_url, v_manual, v_is_test_product
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_marketplace_order(uuid, jsonb, uuid, integer) from public;
grant execute on function public.create_marketplace_order(uuid, jsonb, uuid, integer) to authenticated;

-- Refresh the Supabase REST API schema cache so the new quantity column is visible.
NOTIFY pgrst, 'reload schema';


NOTIFY pgrst, 'reload schema';
