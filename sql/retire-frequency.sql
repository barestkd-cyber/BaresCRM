-- Retire memberships.frequency (Race, 2026-08-26: "retire the frequency column
-- so it cant disagree").
--
-- It was a second answer to a question billing_frequency already answers, and
-- the two disagreed on live rows: Johnny Kubit's Little Kickers membership read
-- one_time on the column the charge engine reads and monthly on this one.
--
-- Nothing wrote it. The column carried DEFAULT 'monthly', so Postgres filled
-- that in on every insert that did not name it - which is every insert, since
-- no code has ever referenced this column. A one-time membership was therefore
-- BORN claiming to be monthly. Verified before dropping: no function, view,
-- index or constraint refers to it, and the only code matches for the word are
-- installmentSchedule's parameter and the kiosk's audio oscillator.
--
-- billing_frequency remains the single answer.
alter table memberships drop column if exists frequency;

select column_name
  from information_schema.columns
 where table_schema='public' and table_name='memberships'
   and column_name in ('frequency','billing_frequency')
 order by column_name;
