select 'Patrick signup made' as t,
       (select (ts.created_at at time zone 'America/Chicago')::timestamp(0)::text
          from testing_signups ts where ts.student_name = 'Florence Patrick Larano') as v
union all
select 'Patrick CRM contact created (name at import)',
       (select (c.created_at at time zone 'America/Chicago')::timestamp(0)::text
             ||' as "'||c.first_name||' '||c.last_name||'" src='||coalesce(c.source,'-')
          from contacts c where c.first_name='Patrick' and c.last_name='Larano')
union all
select 'Patrick sale',
       coalesce((select left(s.id::text,8)||' buyer='||coalesce((select x.first_name||' '||x.last_name from contacts x where x.id=s.buyer_contact_id),'NULL')
             ||' payer='||coalesce(s.payer_name,'-')
          from pos_sales s join testing_signups ts on ts.sale_id = s.id
         where ts.student_name='Florence Patrick Larano' limit 1),'no sale')
union all
select 'Josh seat position',
       coalesce((select 'family_position='||ts.family_position::text from testing_signups ts
          where ts.student_name='Josh Nannen'),'-')
union all
select 'Joshua Nannen contact id',
       coalesce((select c.id::text from contacts c
          where c.first_name='Joshua' and c.last_name='Nannen'),'NOT FOUND');
