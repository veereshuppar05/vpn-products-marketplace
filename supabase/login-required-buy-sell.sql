-- Run this once in Supabase Dashboard > SQL Editor.
-- Logged-out visitors may browse active listings, but cannot read seller phone numbers.
-- Signed-in users continue to use public.listings, protected by the existing RLS policies.

create or replace view public.listings_public as
select
  id,
  title,
  description,
  price,
  category,
  condition,
  city,
  state,
  seller_name,
  image_urls,
  status,
  created_at
from public.listings
where status = 'active';

revoke all on public.listings_public from public;
grant select on public.listings_public to anon, authenticated;

-- Remove anonymous access to the underlying table, which contains contact_phone.
revoke select on table public.listings from anon, public;
grant select on table public.listings to authenticated;

-- Ensure the listing creation permissions remain signed-in only.
grant insert, update, delete on table public.listings to authenticated;

-- Refresh the Supabase Data API schema cache so the new public view is available.
notify pgrst, 'reload schema';
