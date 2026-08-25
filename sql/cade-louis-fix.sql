-- The parent typed "Cade Louos"; the student is Cade Louis (active, White
-- Belt). One flipped letter defeated the exact-match census, so the sale,
-- line and signup all point at nobody. Point them at Cade.
update pos_sales s
   set buyer_contact_id = (select id from contacts where first_name='Cade' and last_name='Louis')
 where left(s.id::text,8) = '0af500b2' and s.buyer_contact_id is null;

update pos_sale_lines l
   set student_contact_id = (select id from contacts where first_name='Cade' and last_name='Louis'),
       label = replace(l.label, 'Cade Louos', 'Cade Louis')
 where l.sale_id = (select id from pos_sales where left(id::text,8)='0af500b2')
   and l.label like '%Cade Louos%';

update testing_signups ts
   set contact_id = (select id from contacts where first_name='Cade' and last_name='Louis'),
       student_name = 'Cade Louis'
 where ts.student_name = 'Cade Louos' and ts.contact_id is null;

select 'sale' as t, coalesce(c.first_name || ' ' || c.last_name,'STILL NULL') as v
  from pos_sales s left join contacts c on c.id = s.buyer_contact_id
 where left(s.id::text,8)='0af500b2'
union all
select 'signup', ts.student_name || ' -> ' || coalesce(left(ts.contact_id::text,8),'NULL')
  from testing_signups ts where ts.student_name in ('Cade Louis','Cade Louos');
