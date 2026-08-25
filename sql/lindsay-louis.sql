select 'sale' as t,
       left(s.id::text,8) || ' · ' || (s.created_at at time zone 'America/Chicago')::timestamp(0)::text as k,
       'buyer=' || coalesce(left(s.buyer_contact_id::text,8),'NULL')
         || ' · email=' || coalesce(s.receipt_email,'-')
         || ' · $' || (s.total_cents/100.0)::text as v
  from pos_sales s
 where s.created_at >= '2026-08-25 04:00:00+00' and s.total_cents > 0
union all
select 'signup', ts.student_name,
       'contact=' || coalesce(left(ts.contact_id::text,8),'NULL')
         || ' · name matches on file: ' ||
       (select count(*) from contacts c
         where c.first_name ilike split_part(ts.student_name,' ',1)
           and c.last_name ilike split_part(ts.student_name,' ',2))::text
  from testing_signups ts
 where ts.created_at >= '2026-08-25 04:00:00+00'
union all
select 'louis_contacts', c.first_name || ' ' || c.last_name,
       c.segment::text || ' · ' || coalesce(c.rank,'no rank')
  from contacts c
 where c.last_name ilike '%louis%' or c.first_name ilike '%lindsay%'
 order by 1;
