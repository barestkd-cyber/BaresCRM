with a as (select * from contacts where segment::text = 'active')
select 'contacts (active)' as scope, count(*)::text as n, '' as pct from a
union all select '  dob', count(*) filter (where dob is not null)::text,
  round(100.0*count(*) filter (where dob is not null)/nullif(count(*),0))::text||'%' from a
union all select '  gender', count(*) filter (where coalesce(gender,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(gender,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  email', count(*) filter (where coalesce(email,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(email,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  phone', count(*) filter (where coalesce(phone,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(phone,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  address', count(*) filter (where coalesce(address,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(address,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  rank', count(*) filter (where coalesce(rank,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(rank,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  belt_size', count(*) filter (where coalesce(belt_size,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(belt_size,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  kick_size', count(*) filter (where coalesce(kick_size,'')<>'')::text,
  round(100.0*count(*) filter (where coalesce(kick_size,'')<>'')/nullif(count(*),0))::text||'%' from a
union all select '  has a guardian', count(distinct sg.student_id)::text,
  round(100.0*count(distinct sg.student_id)/nullif((select count(*) from a),0))::text||'%'
  from student_guardians sg where sg.student_id in (select id from a)
union all select '  has emergency contact', count(distinct sc.student_id)::text,
  round(100.0*count(distinct sc.student_id)/nullif((select count(*) from a),0))::text||'%'
  from student_contacts sc where sc.student_id in (select id from a)
union all select '  in a household', count(distinct hm.contact_id)::text,
  round(100.0*count(distinct hm.contact_id)/nullif((select count(*) from a),0))::text||'%'
  from household_members hm where hm.contact_id in (select id from a)
union all select '  has a card on file', count(*) filter (where stripe_customer_id is not null)::text,
  round(100.0*count(*) filter (where stripe_customer_id is not null)/nullif(count(*),0))::text||'%' from a
union all select 'MEMBERSHIPS (all)', (select count(*) from memberships)::text, ''
union all select 'ENROLLMENTS active', (select count(*) from enrollments where status='active')::text, ''
union all select 'TESTING history rows', (select count(*) from testing_history)::text, ''
union all select 'NOTES', (select count(*) from contact_notes)::text, '';
