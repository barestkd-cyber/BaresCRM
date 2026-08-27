alter table card_rejections add column if not exists payer_name text;
alter table card_rejections add column if not exists student_name text;
alter table card_rejections add column if not exists email text;
alter table card_rejections add column if not exists phone text;
select 'columns ready' as ok;
