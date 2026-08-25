-- Attach Monday's orphan testing sales to their families (owner-approved
-- 2026-08-25). testing_signups is the participant<->sale join: each signup
-- carries sale_id, contact_id and family_position, so nothing is guessed.
--
-- 1. The sale's buyer is the first-registered kid (family_position 1).
update pos_sales s
   set buyer_contact_id = ts.contact_id
  from testing_signups ts
 where ts.sale_id = s.id
   and ts.family_position = 1
   and ts.contact_id is not null
   and s.buyer_contact_id is null;

-- 2. Each invoice LINE points at its own kid, matched by the label the line
--    was written with. This is what lets the invoice appear on every
--    participant's profile, not only the buyer's.
update pos_sale_lines l
   set student_contact_id = ts.contact_id
  from testing_signups ts
 where ts.sale_id = l.sale_id
   and ts.contact_id is not null
   and l.student_contact_id is null
   and l.label like 'Belt testing - ' || ts.student_name || '%';

-- The proof.
select left(s.id::text,8) as sale,
       c.first_name || ' ' || c.last_name as buyer,
       (select count(*) from pos_sale_lines l
         where l.sale_id = s.id and l.student_contact_id is not null) as lines_linked,
       (select count(*) from pos_sale_lines l where l.sale_id = s.id) as lines_total
  from pos_sales s
  left join contacts c on c.id = s.buyer_contact_id
 where s.created_at >= '2026-08-24 05:00:00+00' and s.total_cents > 0
 order by s.created_at;
