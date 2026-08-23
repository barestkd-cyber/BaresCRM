select count(*) as with_spark,
       count(rank) as have_rank,
       count(belt) as have_belt,
       count(belt_size) as have_belt_size,
       count(kick_size) as have_kick_size,
       count(address) as have_address,
       count(joined_on) as have_joined,
       count(entered_on) as have_entered,
       count(last_visit) as have_last_visit,
       count(program) as have_program
from contacts where spark_id is not null;
