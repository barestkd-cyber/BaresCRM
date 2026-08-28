-- What each registrant TYPED as their rank, against what their profile says.
select ts.student_name,
       coalesce(ts.rank,'(blank)') as typed_rank,
       coalesce((select c.rank from contacts c where c.id = ts.contact_id),'(no profile)') as profile_rank,
       case when ts.contact_id is null then 'unlinked'
            when coalesce(ts.rank,'') = coalesce((select c.rank from contacts c where c.id = ts.contact_id),'') then 'match'
            else 'DIFFERS' end as verdict,
       coalesce(td.label,'-') as test_group
  from testing_signups ts
  left join testing_dates td on td.id = ts.testing_date_id
 where ts.created_at >= '2026-08-19'
 order by (case when ts.contact_id is null then 0
                when coalesce(ts.rank,'') <> coalesce((select c.rank from contacts c where c.id=ts.contact_id),'') then 1
                else 2 end), td.label, ts.student_name;
