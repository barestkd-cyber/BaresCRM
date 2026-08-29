-- Why the testing app shows Zachary Lackey at Sr. Yellow: read every rank
-- the system holds for him. Read-only.
select 'CONTACT' as src, first_name || ' ' || last_name as who, rank,
       rank_date::text as since
  from public.contacts
 where id = '9d818111-7d0b-48c6-a753-9692f018b068'
union all
select 'SIGNUP', student_name, rank, created_at::date::text
  from public.testing_signups
 where contact_id = '9d818111-7d0b-48c6-a753-9692f018b068';
