select policyname, cmd,
       coalesce(qual, with_check) as rule
from pg_policies where schemaname='public' and tablename='student_stripes' order by cmd;
