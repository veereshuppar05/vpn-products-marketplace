-- Repair the profile trigger used during customer registration.
-- Run this in Supabase Dashboard > SQL Editor > New query.
--
-- The website stores the customer's name in Auth metadata. This trigger
-- mirrors that information into public.profiles. A profile-sync failure
-- should not prevent Supabase Auth from creating the customer account.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists is_admin boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'phone', ''),
      nullif(new.phone, '')
    )
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
exception
  when others then
    -- Keep account creation independent from the optional profile mirror.
    -- The full name remains available in auth.users.raw_user_meta_data.
    raise warning 'Profile sync failed for new auth user %: %', new.id, sqlerrm;
    return new;
end;
$function$;

drop trigger if exists on_auth_user_created_resell on auth.users;

create trigger on_auth_user_created_resell
after insert on auth.users
for each row
execute function public.handle_new_user();

grant select on public.profiles to authenticated;

notify pgrst, 'reload schema';
