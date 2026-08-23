select id, first_name, last_name, email, phone, rank, segment, created_at
from contacts where created_at::date = '2026-08-22';
