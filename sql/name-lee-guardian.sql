-- Radford's second guardian was unnamed but held leertarry@yahoo.com - that is
-- his dad, Lee. Name the record, point it at Lee's own contact, and put the
-- address on Lee's contact row too (Race, 2026-08-26).
update guardians
   set name = 'Lee Tarry',
       relation = coalesce(nullif(relation,''), 'Dad'),
       contact_id = '732dbbff-f4a6-47e6-8190-b5d97ba6816d'
 where id = '6f677d72-008d-4b27-be72-5afe3e98a795';

update contacts
   set email = 'leertarry@yahoo.com'
 where id = '732dbbff-f4a6-47e6-8190-b5d97ba6816d'
   and coalesce(email,'') = '';

select 'Lee guardian row' as t,
       (select name||' / '||coalesce(relation,'-')||' / linked='||
               case when contact_id is null then 'no' else 'yes' end
          from guardians where id='6f677d72-008d-4b27-be72-5afe3e98a795') as v
union all
select 'Lee contact email',
       (select coalesce(nullif(email,''),'(none)') from contacts
         where id='732dbbff-f4a6-47e6-8190-b5d97ba6816d')
union all
select 'that guardian is on',
       coalesce((select string_agg(c.first_name||' '||c.last_name,', ')
                   from student_guardians sg join contacts c on c.id=sg.student_id
                  where sg.guardian_id='6f677d72-008d-4b27-be72-5afe3e98a795'),'nobody')
union all
select 'Lindsay is on',
       coalesce((select string_agg(c.first_name||' '||c.last_name||' [link label: '
                   ||coalesce(nullif(sg.label,''),'none')||']', ', ')
                   from student_guardians sg join contacts c on c.id=sg.student_id
                  where sg.guardian_id='fc8dd985-7fa4-4fa0-b004-fd8d8893f2bc'),'nobody');
