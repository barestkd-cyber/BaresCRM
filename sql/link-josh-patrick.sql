-- Race's go, 2026-08-27: link the two unmatched registrations.
--
--   "Josh Nannen"             -> Joshua Nannen (typed the short form)
--   "Florence Patrick Larano" -> Patrick Larano (typed the long form)
--
-- Same person, different length of name - the two directions of the one
-- failure the exact matcher cannot see past.

-- The census rows.
update testing_signups set contact_id = '4d17351a-7390-4a4c-b111-a790dd116c73'
 where student_name = 'Josh Nannen' and contact_id is null;
update testing_signups set contact_id = '4dcb1b26-6951-43ae-be48-3812b4320205'
 where student_name = 'Florence Patrick Larano' and contact_id is null;

-- Their invoice lines, so the sale shows on their own profiles.
update pos_sale_lines set student_contact_id = '4d17351a-7390-4a4c-b111-a790dd116c73'
 where label like 'Belt testing - Josh Nannen%' and student_contact_id is null;
update pos_sale_lines set student_contact_id = '4dcb1b26-6951-43ae-be48-3812b4320205'
 where label like 'Belt testing - Florence Patrick Larano%' and student_contact_id is null;

-- Josh was seat 1, so the buyer fallback would have picked HIM had the match
-- worked; the invoice moves from Gavin to the man who actually paid.
update pos_sales set buyer_contact_id = '4d17351a-7390-4a4c-b111-a790dd116c73'
 where left(id::text,8) = 'aaf7aedf';

select ts.student_name,
       coalesce((select c.first_name||' '||c.last_name from contacts c where c.id=ts.contact_id),'STILL UNLINKED') as linked_to
  from testing_signups ts
 where ts.student_name in ('Josh Nannen','Florence Patrick Larano');
