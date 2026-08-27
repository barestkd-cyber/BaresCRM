select 'contacts named Kubit' as t,
       coalesce(string_agg(c.id::text||' '||c.first_name||' '||c.last_name||' seg='||c.segment::text
         ||' created='||c.created_at::date::text, ' | '),'none') as v
  from contacts c where c.last_name ilike '%kubit%'
union all
select 'memberships',
       coalesce(string_agg(left(m.id::text,8)||' '||coalesce(m.program,'-')||' '||m.status::text
         ||' sale='||coalesce(left(m.sale_id::text,8),'none')
         ||' $'||(coalesce(m.final_down_cents,m.down_cents,0)/100.0)::text, ' | '),'none')
  from memberships m join contacts c on c.id=m.contact_id where c.last_name ilike '%kubit%'
union all
select 'enrollments',
       coalesce(string_agg(e.program||' '||e.status||' sale='||coalesce(left(e.sale_id::text,8),'none'), ' | '),'none')
  from enrollments e join contacts c on c.id=e.student_id where c.last_name ilike '%kubit%'
union all
select 'agreements',
       coalesce(string_agg(left(ma.id::text,8)||' '||coalesce(ma.status,'-')
         ||' sale='||coalesce(left(ma.sale_id::text,8),'none')
         ||' signed='||coalesce(ma.signed_at::date::text,'no'), ' | '),'none')
  from membership_agreements ma join contacts c on c.id=ma.contact_id where c.last_name ilike '%kubit%';
