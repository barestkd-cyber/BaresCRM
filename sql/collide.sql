select lower(first_name)||' '||lower(last_name) as name, count(*) as records,
       string_agg(coalesce(rank,'no rank'), ' | ') as ranks
from contacts where first_name is not null and last_name is not null
group by 1 having count(*) > 1 order by 2 desc;
