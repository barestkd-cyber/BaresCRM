select tablename, policyname, cmd, qual
from pg_policies
where schemaname='public' and tablename in ('contacts','households','household_members')
order by tablename, cmd;
