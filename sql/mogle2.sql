select 'now' as t, (now() at time zone 'America/Chicago')::timestamp(0)::text as v
union all
select 'Mogle contacts',
       coalesce((select string_agg(c.first_name||' '||c.last_name||' ['||c.segment::text||'] created '
              ||(c.created_at at time zone 'America/Chicago')::timestamp(0)::text, ' | ')
          from contacts c where c.last_name ilike '%mogle%'),'none')
union all
select 'that sale lines',
       coalesce((select string_agg(l.label||' $'||(l.line_total_cents/100.0)::text,' | ')
          from pos_sale_lines l where l.sale_id::text like 'a7690da2%'),'none')
union all
select 'memberships from it',
       coalesce((select string_agg(m.program||' '||m.status::text,' | ')
          from memberships m where m.sale_id::text like 'a7690da2%'),'none')
union all
select 'enrollments from it',
       coalesce((select string_agg(e.program||' '||e.status,' | ')
          from enrollments e where e.sale_id::text like 'a7690da2%'),'none')
union all
select 'payments on it',
       coalesce((select string_agg(p.kind||' '||(p.amount_cents/100.0)::text,' | ')
          from pos_payments p where p.sale_id::text like 'a7690da2%'),'NONE - never paid');
