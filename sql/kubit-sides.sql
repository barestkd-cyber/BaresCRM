with ids(tag, cid) as (values
  ('OLD 8/18', 'e427d210-07b8-430c-9452-57ed79273818'::uuid),
  ('NEW 8/26', '701d0976-6186-4332-90a2-3dcc98f47bec'::uuid))
select i.tag,
       (select coalesce(c.dob::text,'no dob')||' / rank='||coalesce(c.rank,'-')
             ||' / '||coalesce(nullif(c.address,''),'no address')
          from contacts c where c.id=i.cid) as detail,
       (select count(*)::text from student_guardians sg where sg.student_id=i.cid) as guardians,
       (select count(*)::text from pos_sales s where s.buyer_contact_id=i.cid) as sales,
       (select count(*)::text from memberships m where m.contact_id=i.cid) as memberships,
       (select count(*)::text from enrollments e where e.student_id=i.cid) as rosters,
       (select count(*)::text from attendance a where a.student_id=i.cid) as attendance,
       (select count(*)::text from household_members hm where hm.contact_id=i.cid) as households
  from ids i;
