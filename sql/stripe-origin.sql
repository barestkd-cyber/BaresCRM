-- Which APP a stripe was logged in (owner, 2026-09-03: "i do want to see that
-- it was originated in profile vs crm vs class plan"). Deliberately separate
-- from `source`: source is the trust state (family / staff / verified) and
-- changes when an instructor confirms, while origin is a fact about where the
-- row was created and must survive that. Values: profile | crm | classplan.
-- The one pre-existing row keeps origin null, which reads as "unknown".
alter table public.student_stripes add column if not exists origin text;
comment on column public.student_stripes.origin is
  'App the stripe was logged in: profile (curriculum), crm, or classplan. Never rewritten on verify.';
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='student_stripes' order by ordinal_position;
