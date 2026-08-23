-- Every id this transaction touched, and the record each one points to.
select
  'signup.contact_id'      as field, s.contact_id::text as id,
  coalesce(c.first_name||' '||c.last_name,'(null)') as points_to,
  coalesce(c.rank,'-') as rank, coalesce(c.created_at::text,'-') as record_created
from testing_signups s left join contacts c on c.id = s.contact_id
union all
select 'signup.student_name (typed)', null, s.student_name, coalesce(s.rank,'-'), s.created_at::text
from testing_signups s
union all
select 'sale.buyer_contact_id', sa.buyer_contact_id::text,
  coalesce(c2.first_name||' '||c2.last_name,'(null)'), coalesce(c2.rank,'-'), coalesce(c2.created_at::text,'-')
from pos_sales sa left join contacts c2 on c2.id = sa.buyer_contact_id
where sa.id = '4446c75d-9e8e-4fec-82e1-2198b0988e5c'
union all
select 'line.student_contact_id', l.student_contact_id::text,
  coalesce(c3.first_name||' '||c3.last_name,'(null)'), '-', '-'
from pos_sale_lines l left join contacts c3 on c3.id = l.student_contact_id
where l.sale_id = '4446c75d-9e8e-4fec-82e1-2198b0988e5c';
