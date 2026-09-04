-- Per-invoice permission to pay less than the full balance (owner,
-- 2026-09-04: "I wanna send most of my invoices default pay in full. But
-- before I send, or at any point, let me toggle on partial payments.")
--
-- Default false, so nothing changes for the invoices already out there.
alter table public.pos_sales
  add column if not exists allow_partial boolean not null default false;

comment on column public.pos_sales.allow_partial is
  'When true the customer-facing invoice page offers an amount box instead of a fixed Pay button. The server still clamps the amount to the outstanding balance - the browser can lower its price, never raise it.';

select count(*) filter (where allow_partial) as allowing_partial,
       count(*) as invoices
  from public.pos_sales;
