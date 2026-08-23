select name, count(*) as records from guardians
where name is not null group by name having count(*) > 1;
