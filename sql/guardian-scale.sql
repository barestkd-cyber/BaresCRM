-- How many distinct people are guardians, and how many of them the system
-- already knows as a contact. This is the real size of "too many contacts".
with g as (select distinct lower(email) as email from student_guardians where email is not null)
select (select count(*) from g) as distinct_guardians,
       (select count(*) from g join contacts c on lower(c.email) = g.email) as already_contacts,
       (select count(*) from contacts) as total_contacts,
       (select count(*) from contacts where email is not null) as contacts_with_email;
