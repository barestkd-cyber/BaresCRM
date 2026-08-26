-- Every contact with status, rank and DOB, for roster reconciliation.
select first_name, last_name, segment::text as segment,
       coalesce(email,'') as email, coalesce(rank,'') as rank,
       coalesce(dob::text,'') as dob
  from contacts
 order by last_name, first_name;
