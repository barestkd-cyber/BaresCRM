-- The CRM's OWN answer: active contacts who are Cubs by rank, or 5 and under
-- by date of birth. Independent of the Spark export.
select c.first_name || ' ' || c.last_name as who,
       case when c.dob is null then null
            else date_part('year', age((now() at time zone 'America/Chicago')::date, c.dob))::int
       end as age,
       coalesce(c.dob::text,'no dob') as dob,
       coalesce(c.rank,'no rank') as rank,
       coalesce(c.source,'') as source
  from contacts c
 where c.segment::text = 'active'
   and (c.rank ilike 'cub%'
        or (c.dob is not null
            and date_part('year', age((now() at time zone 'America/Chicago')::date, c.dob)) <= 5))
 order by age nulls last, c.first_name;
