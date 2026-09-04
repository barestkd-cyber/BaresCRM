select pg_get_functiondef(oid) as def from pg_proc where proname = 'my_student_ids';
