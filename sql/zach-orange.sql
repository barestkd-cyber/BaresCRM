-- Owner, 2026-08-28: "zach listed at sr yellow still instead of orange."
-- His 2026-08-27 dictation said Orange; it was parked list-only. Applying
-- to the contact now on his re-assert. The signup row keeps its snapshot;
-- the testing app reads the contact.
update public.contacts
   set rank = 'Orange Belt'
 where id = '9d818111-7d0b-48c6-a753-9692f018b068'
   and rank = 'Senior Yellow Belt';
select first_name || ' ' || last_name as who, rank
  from public.contacts
 where id = '9d818111-7d0b-48c6-a753-9692f018b068';
