-- ===========================================================================
-- The price of adding the SECOND specialty
-- ---------------------------------------------------------------------------
-- Owner's model: one primary membership carries the legalities, and anything
-- else is an add-on line on that same agreement. So "Kickboxing and Jiu Jitsu
-- together" is no longer a separate bundle product needing its own contract.
-- It is a Kickboxing membership plus a Jiu Jitsu add-on, or the reverse.
--
-- His prices: $99 alone, $129 for both. So the second discipline is $30.
--
-- These are real catalog rows rather than arithmetic in the code, so he can
-- change them without a deploy, and so nothing has to infer a price by
-- subtracting one plan from another. sellable=false because they are never
-- pitched on their own; they only ever price an add-on line.
--
-- This makes specialty_both redundant for the website. It stays for now
-- because the POS still lists it and repricing history must not shift.
--
-- Run:  supabase db query --linked -f sql/specialty-second-program.sql
-- ===========================================================================

insert into public.pricing_plans
  (code, name, program, category, billing_frequency, recurring_cents, down_cents, active, sellable)
select v.code, v.name, v.program, 'specialty', 'monthly', 3000, 0, true, false
  from (values
    ('specialty_second_kickboxing', 'Kickboxing — added to another specialty', 'Kickboxing'),
    ('specialty_second_jiujitsu',   'Jiu Jitsu — added to another specialty',  'Jiu Jitsu')
  ) as v(code, name, program)
 where not exists (select 1 from public.pricing_plans p where p.code = v.code);

update public.pricing_plans set recurring_cents = 3000, active = true, sellable = false
 where code in ('specialty_second_kickboxing','specialty_second_jiujitsu');

select code, name, program, '$' || (recurring_cents/100.0)::numeric(10,2)::text as price, sellable
  from public.pricing_plans
 where code like 'addon_%' or code like 'specialty_second_%'
 order by code;
