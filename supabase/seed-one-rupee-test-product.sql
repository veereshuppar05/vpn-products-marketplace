-- Create one clearly labelled ₹1 test product for checkout and cancellation testing.
-- Run AFTER shipping-integration.sql and order-lifecycle.sql.
-- Uses the first administrator profile as the listing owner. A separate customer
-- account must be used to place an order because sellers cannot buy their own listings.

do $$
declare
  v_admin_id uuid;
  v_seller_name text;
  v_city text := 'VPN Shop';
  v_state text := 'Karnataka';
  v_phone text := '9916140898';
begin
  select p.id, coalesce(nullif(trim(p.full_name), ''), 'VPN Products and Services'),
         coalesce(nullif(trim(p.phone), ''), '9916140898')
    into v_admin_id, v_seller_name, v_phone
  from public.profiles p
  where p.is_admin = true
  order by p.created_at asc
  limit 1;

  if v_admin_id is null then
    raise exception 'No administrator profile was found. First set profiles.is_admin = true for your shop account, then run this file again.';
  end if;

  select coalesce(nullif(l.city,''),v_city), coalesce(nullif(l.state,''),v_state),
         coalesce(nullif(l.contact_phone,''),v_phone)
    into v_city,v_state,v_phone
  from public.listings l
  where l.seller_id = v_admin_id
  order by l.created_at desc
  limit 1;

  if exists (
    select 1 from public.listings
    where seller_id = v_admin_id and is_test_product = true
      and title = 'VPN ₹1 Checkout Test Product'
  ) then
    raise notice 'The ₹1 test product already exists. No duplicate was added.';
    return;
  end if;

  insert into public.listings (
    seller_id,title,description,price,category,condition,city,state,
    contact_phone,seller_name,image_urls,status,
    package_weight_kg,package_length_cm,package_breadth_cm,package_height_cm,
    is_test_product
  ) values (
    v_admin_id,
    'VPN ₹1 Checkout Test Product',
    'TEST ONLY: Use this ₹1 item to test checkout, order history and cancellation. No physical parcel will be shipped. Cancel your test order after placing it.',
    1.00,
    'Other Products',
    'Good',
    coalesce(v_city,'VPN Shop'),
    coalesce(v_state,'Karnataka'),
    coalesce(v_phone,'9916140898'),
    v_seller_name,
    '[]'::jsonb,
    'active',
    0.05,
    10,
    10,
    5,
    true
  );
end $$;

notify pgrst, 'reload schema';
