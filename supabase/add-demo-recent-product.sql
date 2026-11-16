-- Add one clearly labelled demo product to the live marketplace.
-- Run once in Supabase Dashboard > SQL Editor > New query.
-- The insert is idempotent: rerunning it will not create a duplicate.
-- The listing is active and receives created_at = now(), so it appears first
-- in the homepage's "Recently Added Products" section.

do $$
declare
  v_admin_id uuid;
  v_seller_name text;
  v_phone text;
begin
  select
    p.id,
    coalesce(nullif(trim(p.full_name), ''), 'VPN Products and Services'),
    coalesce(nullif(regexp_replace(trim(coalesce(p.phone, '')), '\\D', '', 'g'), ''), '9916140898')
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
      and title = 'DEMO ONLY - Smart LED Desk Lamp'
  ) then
    raise notice 'The demo product already exists; no duplicate was added.';
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
    'DEMO ONLY - Smart LED Desk Lamp',
    'DEMO LISTING: This sample product was added to check the Recently Added Products section and newest-first sorting. It is not a confirmed item for sale. Please do not place an order for this demo listing.',
    899.00,
    'Home & Kitchen',
    'Good',
    'Bengaluru',
    'Karnataka',
    v_phone,
    v_seller_name,
    '["https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85"]'::jsonb,
    'active',
    0.40,
    20,
    15,
    12,
    false,
    now()
  );
end $$;

notify pgrst, 'reload schema';
