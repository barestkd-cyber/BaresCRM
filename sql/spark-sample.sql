select spark_id, first_name, last_name from contacts
where spark_id is not null order by first_name limit 5;
