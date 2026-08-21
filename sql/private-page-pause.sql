-- PAUSED while fixing defects found by adversarial review: a shopper who
-- changed their pick after a card decline could be charged the OLD amount
-- ($216.39 against a displayed $35.00), and abandoned checkouts held slots
-- forever. Nobody has booked; no money has moved. Re-enabled the moment the
-- fixes are verified.
update public.settings set private_page_live = false where id = true;
select private_page_live,
  (select count(*) from public.private_lessons) as bookings,
  (select count(*) from public.pos_sales where staff_email='private-checkout@website') as private_sales
  from public.settings limit 1;
