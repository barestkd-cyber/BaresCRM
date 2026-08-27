select 'guardian customers' as t,
       coalesce(string_agg(coalesce(nullif(g.name,''),'(unnamed)')||' -> '||coalesce(g.stripe_customer_id,'NONE'),' | '),'none') as v
  from guardians g where g.name ilike '%mogle%'
union all
select 'contact customers',
       coalesce(string_agg(c.first_name||' '||c.last_name||' email='||coalesce(nullif(c.email,''),'-')
         ||' -> '||coalesce(c.stripe_customer_id,'NONE'),' | '),'none')
  from contacts c where c.last_name ilike '%mogle%';
