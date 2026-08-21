-- Owner, 2026-08-20: "make it live". Turns on the public private lesson
-- booking page. Reversible from the CRM (Checkout pages) at any time.
update public.settings set private_page_live = true where id = true;
select private_page_live, private_rate_cents, private_blocked_slots from public.settings limit 1;
