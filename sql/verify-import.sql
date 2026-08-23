-- Nothing that was already known should have moved.
select
  (select count(*) from contacts) as total_contacts,
  (select count(*) from contacts where dob is not null) as dob_all,
  (select count(*) from contacts where rank is not null) as rank_all,
  (select count(*) from contacts where last_visit is not null) as last_visit_all,
  (select count(*) from contacts where email is not null) as email_all,
  (select count(*) from contacts where joined_on is not null) as joined_all;
