-- The name the payer TYPED, verbatim, on every sale. Additive. Exists so no
-- surface ever has to print "Walk-in" as a guess when a human wrote their
-- actual name into the checkout (owner, 2026-08-25, verbatim demand).
alter table pos_sales add column if not exists payer_name text;
select 'payer_name column ready' as ok;
