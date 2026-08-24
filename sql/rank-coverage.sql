select coalesce(rank,'(none)') as rank, count(*) as people
from contacts where rank is not null group by rank order by 2 desc;
