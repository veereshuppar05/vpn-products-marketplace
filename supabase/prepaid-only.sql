-- Enforce prepaid-only orders. Run AFTER supabase/shipping-integration.sql.
-- COD is deliberately not an accepted payment method.
alter table public.marketplace_orders
  add column if not exists payment_method text not null default 'prepaid';

-- Any legacy COD order is reset to unpaid/pending; it is not booked or shipped.
update public.marketplace_orders
set payment_status = 'pending'
where lower(coalesce(payment_status, '')) = 'cod';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_orders_prepaid_only_check'
      and conrelid = 'public.marketplace_orders'::regclass
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_prepaid_only_check
      check (payment_method = 'prepaid');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_orders_payment_status_prepaid_check'
      and conrelid = 'public.marketplace_orders'::regclass
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_payment_status_prepaid_check
      check (payment_status in ('pending', 'paid'));
  end if;
end $$;

comment on column public.marketplace_orders.payment_method is
  'Only prepaid payment is supported. Cash on Delivery is not available.';

comment on column public.marketplace_orders.payment_status is
  'Prepaid payment status: pending until advance payment is received, then paid.';

notify pgrst, 'reload schema';
