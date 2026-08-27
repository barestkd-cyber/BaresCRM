-- What a customer was told when a checkout refused their card. Nothing here
-- touches card data: Stripe.js never gives the page a card number, only a
-- reason string.
create table if not exists card_rejections (
  id uuid primary key default gen_random_uuid(),
  page text,
  code text,
  message text,
  created_at timestamptz not null default now()
);
alter table card_rejections enable row level security;
drop policy if exists card_rejections_staff_read on card_rejections;
create policy card_rejections_staff_read on card_rejections
  for select to authenticated using (is_staff());
select 'card_rejections ready' as ok;
