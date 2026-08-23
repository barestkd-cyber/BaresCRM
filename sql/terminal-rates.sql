select key, value_cents from pricing_settings
where key like '%admin_fee%' order by key;
