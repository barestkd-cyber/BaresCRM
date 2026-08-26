-- Race's four rulings on the Spark/CRM roster differences, 2026-08-26.
--
--   Sophie Cater   -> create; she is John Cater's sister (same address, same
--                     mother). Phone and email are the HOUSEHOLD's and belong
--                     on the guardian, never on a 10-year-old.
--   David Watkins  -> he is Sam's dad, not a student. Already present as the
--                     guardian "Dave Watkins"; Spark's contact details for him
--                     are filled in rather than a second person being created.
--   Patrick Larano -> same person as Spark's "Florence Patrick Larano".
--                     The CRM's name stands. No action.
--   Emerson Allen  -> Trial becomes Active.

-- 1. Sophie Cater, and her link to Maranda Cater.
insert into contacts (first_name, last_name, segment, rank, dob, address, entered_on, source, brand)
select 'Sophie', 'Cater', 'active', 'White Belt', date '2016-07-19',
       '13695 eastside rd, Tyler, TX 75707', date '2026-01-19', 'spark', 'btkd'
 where not exists (select 1 from contacts where first_name='Sophie' and last_name='Cater');

insert into student_guardians (student_id, guardian_id, label, email)
select c.id, g.id, 'Mom',
       coalesce((select ge.email from guardian_emails ge where ge.guardian_id = g.id limit 1), '')
  from contacts c, guardians g
 where c.first_name='Sophie' and c.last_name='Cater'
   and g.id = '26bb2f9b-49c7-43ca-a92a-47b1d0403d36'          -- Maranda Cater
   and not exists (select 1 from student_guardians x
                    where x.student_id=c.id and x.guardian_id=g.id);

-- 2. David Watkins' details onto the existing "Dave Watkins" guardian.
update guardians g
   set phones = case when coalesce(array_length(g.phones,1),0) = 0
                     then array['5125421756'] else g.phones end,
       address = coalesce(nullif(g.address,''), '19117 Lakeshore Dr, Tyler, TX 75703')
 where g.id in (select sg.guardian_id from student_guardians sg
                  join contacts c on c.id = sg.student_id
                 where c.first_name='Sam' and c.last_name='Watkins');

insert into guardian_emails (guardian_id, email)
select sg.guardian_id, v.email
  from student_guardians sg
  join contacts c on c.id = sg.student_id
  cross join (values ('dcwatkins04@gmail.com'), ('david@davewatkins.net')) as v(email)
 where c.first_name='Sam' and c.last_name='Watkins'
   -- guardian_emails is UNIQUE on lower(email) GLOBALLY, not per guardian:
   -- one address belongs to exactly one person. So the guard has to be global
   -- too, or an address already on file anywhere aborts the whole run.
   and not exists (select 1 from guardian_emails ge where lower(ge.email) = v.email);

-- 3. Emerson Allen becomes Active.
update contacts set segment = 'active'
 where first_name='Emerson' and last_name='Allen' and segment::text <> 'active';

-- Proof.
select 'Sophie Cater' as who,
       (select c.segment::text || ' / ' || coalesce(c.rank,'-') || ' / dob ' || coalesce(c.dob::text,'-')
          from contacts c where c.first_name='Sophie' and c.last_name='Cater') as detail
union all
select 'Sophie guardians',
       (select string_agg(g.name,', ') from student_guardians sg
          join guardians g on g.id=sg.guardian_id join contacts c on c.id=sg.student_id
         where c.first_name='Sophie' and c.last_name='Cater')
union all
select 'Sam Watkins dad',
       (select g.name || ' | ' || coalesce(array_to_string(g.phones,','),'-') || ' | '
             || coalesce((select string_agg(ge.email,', ') from guardian_emails ge where ge.guardian_id=g.id),'-')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Sam' and c.last_name='Watkins' limit 1)
union all
select 'Emerson Allen',
       (select c.segment::text from contacts c where c.first_name='Emerson' and c.last_name='Allen');
