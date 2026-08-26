-- A place for medical concerns. Nobody has one today (Race, 2026-08-26), but
-- the Spark export carries the field and the CRM had nowhere to put it, so the
-- spot exists before it is ever needed rather than after.
alter table contacts add column if not exists medical_concerns text;
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='contacts' and column_name='medical_concerns';
