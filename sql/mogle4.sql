select 'Cody stripe_customer_id' as t,
       (select coalesce(c.stripe_customer_id,'NONE') from contacts c
         where c.first_name='Cody' and c.last_name='Mogle') as v
union all
select 'Michelle guardian customer',
       (select coalesce(g.stripe_customer_id,'NONE') from guardians g where g.name='Michelle Mogle')
union all
select 'Cody segment / created',
       (select c.segment::text||' at '||(c.created_at at time zone 'America/Chicago')::timestamp(0)::text
          from contacts c where c.first_name='Cody' and c.last_name='Mogle');
