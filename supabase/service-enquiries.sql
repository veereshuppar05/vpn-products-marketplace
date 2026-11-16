-- Public service enquiry form submissions with administrator-only review.
-- Run once in Supabase SQL Editor.
create table if not exists public.service_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  email text not null default '' check (char_length(email) <= 254),
  service text not null check (service in (
    'computer-shop-services',
    'mobile-services',
    'xerox-printing-scanning',
    'online-application-assistance',
    'website-development'
  )),
  details text not null check (char_length(trim(details)) between 10 and 2000),
  preferred_contact text not null default 'whatsapp'
    check (preferred_contact in ('whatsapp','phone','email')),
  status text not null default 'new'
    check (status in ('new','contacted','closed')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_enquiries_created_idx
  on public.service_enquiries(created_at desc);
create index if not exists service_enquiries_status_created_idx
  on public.service_enquiries(status, created_at desc);

alter table public.service_enquiries enable row level security;

drop policy if exists "visitors submit service enquiries" on public.service_enquiries;
create policy "visitors submit service enquiries"
  on public.service_enquiries
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "admins read service enquiries" on public.service_enquiries;
create policy "admins read service enquiries"
  on public.service_enquiries
  for select to authenticated
  using (public.is_resell_admin());

drop policy if exists "admins update service enquiries" on public.service_enquiries;
create policy "admins update service enquiries"
  on public.service_enquiries
  for update to authenticated
  using (public.is_resell_admin())
  with check (public.is_resell_admin());

revoke all on public.service_enquiries from anon, authenticated;
grant insert on public.service_enquiries to anon, authenticated;
grant select, update on public.service_enquiries to authenticated;

notify pgrst, 'reload schema';
