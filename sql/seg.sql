select coalesce(segment,'(none)') as segment, count(*) as n
from contacts where spark_id is not null group by 1 order by 2 desc;
