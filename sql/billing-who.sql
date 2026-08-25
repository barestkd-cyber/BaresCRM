select left(to_jsonb(m)::text, 600) as row from memberships m order by m.created_at;
