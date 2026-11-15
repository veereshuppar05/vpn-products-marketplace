-- VPN Products marketplace schema for Supabase (Postgres)
-- Run this entire file in Supabase Dashboard > SQL Editor > New query.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 90),
  description text not null check (char_length(description) between 20 and 1500),
  price numeric(12,2) not null check (price > 0),
  category text not null,
  condition text not null check (condition in ('Like New', 'Good', 'Fair', 'For Parts')),
  city text not null,
  state text not null,
  contact_phone text not null,
  seller_name text not null,
  image_urls jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'sold')),
  created_at timestamptz not null default now()
);

create index if not exists listings_status_created_idx on public.listings(status, created_at desc);
create index if not exists listings_seller_created_idx on public.listings(seller_id, created_at desc);
create index if not exists listings_category_idx on public.listings(category);
create index if not exists listings_location_idx on public.listings(state, city);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
create index if not exists listing_reports_listing_idx on public.listing_reports(listing_id, created_at desc);

-- Create a profile automatically whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_resell on auth.users;
create trigger on_auth_user_created_resell
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Check administrator status without exposing profile data to other users.
create or replace function public.is_resell_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Sellers cannot change ownership or self-approve a pending/rejected listing.
create or replace function public.guard_listing_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_resell_admin() then
    if auth.uid() is distinct from old.seller_id then
      raise exception 'Not allowed to update this listing';
    end if;
    if new.seller_id is distinct from old.seller_id then
      raise exception 'Listing ownership cannot be changed';
    end if;
    if new.status is distinct from old.status
       and not (old.status = 'active' and new.status = 'sold') then
      raise exception 'Sellers may only mark an active listing as sold';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_resell_listing_update on public.listings;
create trigger guard_resell_listing_update
before update on public.listings
for each row execute procedure public.guard_listing_update();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_reports enable row level security;

-- Profiles: users can see their own profile; admins can see all profiles.
drop policy if exists "profile read self or admin" on public.profiles;
create policy "profile read self or admin" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_resell_admin());

-- Listing visibility: public visitors see active items; owners/admins can see their own/moderation items.
drop policy if exists "public read active listings" on public.listings;
create policy "public read active listings" on public.listings
for select to anon, authenticated
using (status = 'active' or seller_id = auth.uid() or public.is_resell_admin());

drop policy if exists "seller create pending listing" on public.listings;
create policy "seller create pending listing" on public.listings
for insert to authenticated
with check (seller_id = auth.uid() and status = 'pending');

drop policy if exists "seller update own listing or admin" on public.listings;
create policy "seller update own listing or admin" on public.listings
for update to authenticated
using (seller_id = auth.uid() or public.is_resell_admin())
with check (seller_id = auth.uid() or public.is_resell_admin());

drop policy if exists "seller delete own listing or admin" on public.listings;
create policy "seller delete own listing or admin" on public.listings
for delete to authenticated
using (seller_id = auth.uid() or public.is_resell_admin());

-- Reports can be submitted by signed-in or anonymous visitors.
drop policy if exists "visitors submit listing reports" on public.listing_reports;
create policy "visitors submit listing reports" on public.listing_reports
for insert to anon, authenticated
with check (reporter_id is null or reporter_id = auth.uid());

drop policy if exists "admins read listing reports" on public.listing_reports;
create policy "admins read listing reports" on public.listing_reports
for select to authenticated
using (public.is_resell_admin());

-- Public image bucket. Images are uploaded under a folder named with the user's auth UID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read listing images" on storage.objects;
create policy "public read listing images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'listing-images');

drop policy if exists "users upload their listing images" on storage.objects;
create policy "users upload their listing images" on storage.objects
for insert to authenticated
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update their listing images" on storage.objects;
create policy "users update their listing images" on storage.objects
for update to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their listing images" on storage.objects;
create policy "users delete their listing images" on storage.objects
for delete to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- After your first account is created, make it an administrator in the SQL Editor:
-- update public.profiles set is_admin = true where id = 'YOUR-AUTH-USER-UUID';

-- Explicit Data API permissions. These are needed because the Supabase project
-- was created with automatic exposure of new tables disabled. RLS policies
-- above continue to restrict which rows each role can access.
grant usage on schema public to anon, authenticated;
grant select on table public.listings to anon, authenticated;
grant insert, update, delete on table public.listings to authenticated;
grant select on table public.profiles to authenticated;
grant insert on table public.listing_reports to anon, authenticated;
grant select on table public.listing_reports to authenticated;
grant execute on function public.is_resell_admin() to anon, authenticated;
