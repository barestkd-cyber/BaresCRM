select 'Daniel Ko contact' as t,
       (select c.id::text||' seg='||c.segment::text from contacts c
         where c.first_name='Daniel' and c.last_name='Ko') as v
union all
select 'Daniel Ko guardians',
       coalesce((select string_agg(coalesce(nullif(g.name,''),'(UNNAMED)')||' ['||coalesce(sg.label,'-')||']',', ')
          from student_guardians sg join guardians g on g.id=sg.guardian_id
          join contacts c on c.id=sg.student_id
         where c.first_name='Daniel' and c.last_name='Ko'),'NONE')
union all
select 'his testing sale',
       coalesce((select left(s.id::text,8)||' payer='||coalesce(s.payer_name,'-')
                 ||' email='||coalesce(s.payer_email,'-')
                 ||' buyer='||coalesce(bc.first_name||' '||bc.last_name,'NULL')
                 ||' cust='||coalesce(s.stripe_customer_id,'-')
          from testing_signups ts join pos_sales s on s.id=ts.sale_id
          left join contacts bc on bc.id=s.buyer_contact_id
         where ts.student_name ilike '%daniel%ko%' order by s.created_at desc limit 1),'no sale')
union all
select 'who holds that email',
       coalesce((select 'guardian '||coalesce(nullif(g.name,''),'(UNNAMED)')
          from guardian_emails ge join guardians g on g.id=ge.guardian_id
         where lower(ge.email)='kyungsk612@gmail.com'),'NOBODY');
