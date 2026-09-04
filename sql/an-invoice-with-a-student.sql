select s.view_token, trim(c.first_name||' '||c.last_name) as line_is_for, l.label
  from public.pos_sale_lines l
  join public.pos_sales s on s.id = l.sale_id
  join public.contacts c on c.id = l.student_contact_id
 where l.student_contact_id is not null
 order by s.created_at desc limit 3;
