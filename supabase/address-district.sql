-- Add district to existing saved delivery addresses.
-- Existing address rows are kept unchanged; new address submissions require a district.
alter table public.customer_addresses
  add column if not exists district text;

comment on column public.customer_addresses.district is
  'Selected district for the saved delivery address.';

notify pgrst, 'reload schema';
