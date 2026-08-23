select policyname, cmd, roles::text, qual
from pg_policies where schemaname='public' and tablename='student_guardians';
