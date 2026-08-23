select (select count(*) from households) as households,
       (select count(*) from household_members) as members,
       (select count(distinct household_id) from household_members) as non_empty;
