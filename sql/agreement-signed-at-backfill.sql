-- Website-signed agreements carried no signed_at (the checkout functions
-- never stamped it - fixed 2026-08-30). For rows that hold a signature,
-- created_at IS the signing moment: the row is written in the same breath
-- as the signature on the public page.
update public.membership_agreements
   set signed_at = created_at
 where signed_at is null
   and signature_png is not null;

select count(*) filter (where signed_at is null) as still_unstamped,
       count(*) as total
  from public.membership_agreements;
