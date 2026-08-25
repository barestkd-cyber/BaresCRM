-- ONE column for "the email typed at checkout" (audit item 3, owner: do it
-- all). stripe_email and receipt_email both meant this; every old sale is
-- backfilled so readers can drop the coalesce dance. Going forward:
--   payer_email   = typed at checkout, stamped at sale creation, immutable
--   receipt_email = where a receipt last actually WENT (the delivery stamp
--                   send-receipt already writes on every send)
--   stripe_email  = dead, kept for history, no writers
alter table pos_sales add column if not exists payer_email text;
update pos_sales
   set payer_email = coalesce(payer_email, receipt_email, stripe_email)
 where payer_email is null and coalesce(receipt_email, stripe_email) is not null;
select count(*) filter (where payer_email is not null) as with_payer_email,
       count(*) as total_sales
  from pos_sales;
