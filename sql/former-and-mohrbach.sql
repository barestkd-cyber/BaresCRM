-- Race's rulings, 2026-08-26.
--   Luther Lenton, Iris Machicek -> former students.
--   Mike Mohrbach -> Rebecca's dad and a GBS client. He is already
--     brand=gbs with a real $257.55 sale, so his status stands; what was
--     missing is the link to his daughter, who had no guardian at all.
update contacts set segment = 'former'
 where (first_name='Luther' and last_name='Lenton')
    or (first_name='Iris'   and last_name='Machicek');

-- Mike as a guardian person, pointed back at his own contact record.
insert into guardians (name, relation, contact_id)
select 'Mike Mohrbach', 'Dad', c.id
  from contacts c
 where c.first_name='Mike' and c.last_name='Mohrbach'
   and not exists (select 1 from guardians g where g.name = 'Mike Mohrbach');

insert into student_guardians (student_id, guardian_id, label, email)
select r.id, g.id, 'Dad', ''
  from contacts r, guardians g
 where r.first_name='Rebecca' and r.last_name='Mohrbach'
   and g.name='Mike Mohrbach'
   and not exists (select 1 from student_guardians x
                    where x.student_id=r.id and x.guardian_id=g.id);

select 'Luther Lenton' as who, (select segment::text from contacts where first_name='Luther' and last_name='Lenton') as v
union all select 'Iris Machicek', (select segment::text from contacts where first_name='Iris' and last_name='Machicek')
union all select 'Mike Mohrbach', (select segment::text||' / brand='||brand from contacts where first_name='Mike' and last_name='Mohrbach')
union all select 'Rebecca guardians',
  coalesce((select string_agg(g.name||' ('||coalesce(g.relation,'-')||')',', ')
     from student_guardians sg join guardians g on g.id=sg.guardian_id
     join contacts c on c.id=sg.student_id
    where c.first_name='Rebecca' and c.last_name='Mohrbach'),'none');
