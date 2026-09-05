select 'CHECKIN' as probe,
       trim(c.first_name||' '||c.last_name) as a,
       a.class_label as b,
       a.source::text as c,
       a.class_date::text as d
  from public.attendance a
  left join public.contacts c on c.id = a.student_id
 where a.class_date >= current_date - 2
union all
select 'STRIPE', trim(c.first_name||' '||c.last_name),
       s.belt||' · '||s.stripe_key, s.source||' / '||coalesce(s.origin,'-'),
       s.earned_at::date::text
  from public.student_stripes s
  left join public.contacts c on c.id = s.student_id
 where s.earned_at >= now() - interval '2 days'
union all
select 'PROMOTION', trim(c.first_name||' '||c.last_name),
       coalesce(p.rank_from,'?')||' -> '||p.rank_to, p.kind, p.created_at::date::text
  from public.rank_promotions p
  left join public.contacts c on c.id = p.student_id
 where p.created_at >= now() - interval '2 days'
 order by 1, 4, 2;
