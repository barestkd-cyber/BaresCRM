select policyname, cmd, qual from pg_policies
where schemaname='public' and tablename='student_stripes';
