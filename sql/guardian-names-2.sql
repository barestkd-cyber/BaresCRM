-- Two the automatic pass could not know, answered by the owner 2026-08-22.
-- billcookefam@ is Linda's: it is the FAMILY address, named after Bill, which
-- is exactly why "the address carries a name" could not settle it.
-- sdkrumrei@ is Stephanie Moseley, whose address carries neither the Moseley
-- surname nor her first name.
update public.student_guardians
set name = 'Linda Cooke' where lower(email) = 'billcookefam@yahoo.com' and name is null;

update public.student_guardians
set name = 'Stephanie Moseley' where lower(email) = 'sdkrumrei@aol.com' and name is null;

select count(*) filter (where name is not null and name <> '') as with_name,
       count(*) as rows from public.student_guardians;
