-- Add one more clearly labelled ₹1 demo/test product to the live marketplace.
-- Run once in Supabase Dashboard > SQL Editor > New query.
-- Safe to rerun: this exact seller/title combination is checked before insert.
-- The new created_at timestamp places it at the top of Recently Added Products.

do $$
declare
  v_admin_id uuid;
  v_seller_name text;
  v_phone text;
begin
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), 'VPN Products and Services'),
    coalesce(nullif(trim(p.phone), ''), '9916140898')
  into v_admin_id, v_seller_name, v_phone
  from public.profiles p
  where p.is_admin = true
  order by p.created_at asc
  limit 1;

  if v_admin_id is null then
    raise exception 'No administrator profile found. Check public.profiles.is_admin before running this script.';
  end if;

  if exists (
    select 1
    from public.listings
    where seller_id = v_admin_id
      and title = 'VPN Demo Product - Wireless Bluetooth Earbuds'
  ) then
    raise notice 'The wireless earbuds demo product already exists; no duplicate was added.';
    return;
  end if;

  insert into public.listings (
    seller_id,
    title,
    description,
    price,
    category,
    condition,
    city,
    state,
    contact_phone,
    seller_name,
    image_urls,
    status,
    package_weight_kg,
    package_length_cm,
    package_breadth_cm,
    package_height_cm,
    is_test_product,
    created_at
  ) values (
    v_admin_id,
    'VPN Demo Product - Wireless Bluetooth Earbuds',
    'DEMO TEST PRODUCT: This ₹1 sample listing is for checking the Recently Added Products section, product details and checkout/cancellation testing. It is not a real item for sale. Do not arrange delivery. Orders containing this test item cannot be paid or shipped through Shiprocket.',
    1.00,
    'Electronics & Gadgets',
    'Good',
    'Bengaluru',
    'Karnataka',
    v_phone,
    v_seller_name,
    '["https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=85"]'::jsonb,
    'active',
    0.10,
    12,
    10,
    5,
    true,
    now()
  );
end $$;

notify pgrst, 'reload schema';
