-- Repair/ensure the fields required by the customer order-cancellation flow.
-- Safe to run more than once. Does not change, delete or cancel existing orders.
-- Run in Supabase Dashboard > SQL Editor > New query.

alter table public.marketplace_orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
