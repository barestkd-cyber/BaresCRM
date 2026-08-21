-- Owner, 2026-08-20: "1192 is the right number i think i put 1199 for ease so
-- lets stick with it since i want 7 more bucks." The printed PDF says $1,199,
-- so the page matches the paper.
--
-- The live price lives in pricing_plans, which is what the checkout functions
-- and the CRM actually read. There is ALSO a legacy plans/programs pair that
-- nothing reads (0 references in BaresCRM/index.html and 0 in the edge
-- functions) and whose numbers are stale; my first pass edited that by
-- mistake and this puts it back.
update public.pricing_plans
   set pif_cents = 119900
 where code = 'cubs_option_a';

update public.plans pl
   set down_cents = 95000
  from public.programs pr
 where pr.id = pl.program_id and pr.name = 'Cubs' and pl.name ilike '%full%';

select code, pif_cents from public.pricing_plans where code = 'cubs_option_a';
