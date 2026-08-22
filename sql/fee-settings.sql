select key, value from app_settings
where key ilike '%fee%' or key ilike '%ach%'
order by key;
