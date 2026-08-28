select left(s.id::text,8) as invoice,
       (s.created_at at time zone 'America/Chicago')::timestamp(0)::text as made,
       coalesce(s.staff_email,'-') as source,
       (s.total_cents/100.0)::text as amt,
       coalesce(c.first_name||' '||c.last_name,'(no buyer)') as invoice_filed_under,
       coalesce(s.payer_name,'(none)') as payer_name,
       coalesce((select string_agg(l.label || coalesce(' -> '||sc.first_name||' '||sc.last_name,''), ' | ')
                   from pos_sale_lines l left join contacts sc on sc.id = l.student_contact_id
                  where l.sale_id = s.id),'no lines') as lines
  from pos_sales s left join contacts c on c.id = s.buyer_contact_id
 where s.buyer_contact_id in (select id from contacts where last_name ilike '%nannen%')
    or lower(coalesce(s.payer_name,'')) like '%nannen%'
 order by s.created_at desc;
