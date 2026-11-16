-- Cart quantity support for VPN Products and Services.
-- Run this in Supabase SQL Editor AFTER supabase/commerce.sql.
-- Safe to run more than once.

alter table public.cart_items
  add column if not exists quantity smallint not null default 1;

alter table public.cart_items
  drop constraint if exists cart_items_quantity_check;
alter table public.cart_items
  add constraint cart_items_quantity_check check (quantity between 1 and 99);

alter table public.marketplace_order_items
  drop constraint if exists marketplace_order_items_quantity_check;
alter table public.marketplace_order_items
  add constraint marketplace_order_items_quantity_check check (quantity between 1 and 99);

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
  v_quantity integer := 1;
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
    v_total := v_total + (v_price * v_quantity);
  end loop;

  insert into public.marketplace_orders (buyer_id, delivery_address, subtotal, status)
  values (v_user_id, v_address, v_total, 'pending_confirmation')
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
      v_price, v_quantity, v_seller_name, v_image_url, v_manual
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.create_marketplace_order(uuid, jsonb) from public;
grant execute on function public.create_marketplace_order(uuid, jsonb) to authenticated;

-- Refresh the Supabase REST API schema cache so the new quantity column is visible.
NOTIFY pgrst, 'reload schema';
