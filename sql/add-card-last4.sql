-- What card paid this. Stripe already sends brand and last4 on the events we
-- store; nothing captured them, so a receipt could not say which card was used
-- (Race, 2026-08-26). Additive.
alter table pos_payments add column if not exists card_brand text;
alter table pos_payments add column if not exists card_last4 text;
select column_name from information_schema.columns
 where table_schema='public' and table_name='pos_payments' and column_name like 'card_%';
