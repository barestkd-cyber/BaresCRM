-- ===========================================================================
-- Who a receipt goes to: one rule, in one place
-- ---------------------------------------------------------------------------
-- Two callers resolve recipients today - send-receipt when nothing is passed
-- (the automatic send after a payment) and the CRM's Email sheet when it
-- prefills. Both currently read the buyer's own address off contacts, which
-- is what mailed Carlton's receipt under Emerson's name.
--
-- A function rather than the rule written twice, for the same reason the card
-- fee is one function: two copies of a money-or-mail rule drift, and the
-- drift is discovered by a customer.
--
-- THE RULE, as the owner stated it on 2026-08-23:
--   1. If the participant has their own address, that is who it goes to.
--      "When I was 12 playing baseball I handled my own information." A
--      sixteen-year-old is not cc'd to his parents by default.
--   2. Otherwise the household's primary contact.
--   3. Plus anybody flagged always_copy, in either case. That is the standing
--      answer to "send us both each receipt", so it applies even when the
--      participant has their own address - the parent asked to be copied.
--
-- WHEN NO PRIMARY IS SET, which is every household today, it picks rather
-- than sending nothing: earliest guardian first, ties broken by whoever has
-- more on file. "And if not, it could just be random. I don't care."
--
-- One address per guardian, the earliest they gave us. Katie Hardin answers
-- to two and is one woman; mailing both is mailing her twice.
-- ===========================================================================

create or replace function public.contact_send_list(p_contact uuid)
returns table (email text, why text)
language sql
stable
security definer
set search_path = public
as $$
  with hh as (
    -- everyone whose guardians count for this participant: themselves, plus
    -- the rest of their household. Sharing is live here exactly as it is on
    -- the profile, so the two can never disagree about who is family.
    select p_contact as contact_id
    union
    select hm2.contact_id
    from household_members hm1
    join household_members hm2 on hm2.household_id = hm1.household_id
    where hm1.contact_id = p_contact
  ),
  scope as (
    select distinct g.id, g.created_at,
           (select count(*) from guardian_emails e where e.guardian_id = g.id)
             + coalesce(array_length(g.phones, 1), 0) as detail
    from student_guardians sg
    join guardians g on g.id = sg.guardian_id
    where sg.student_id in (select contact_id from hh)
  ),
  -- the primary as set, or the fallback pick
  chosen as (
    select coalesce(
      (select h.primary_guardian_id
         from household_members hm
         join households h on h.id = hm.household_id
        where hm.contact_id = p_contact and h.primary_guardian_id is not null
        limit 1),
      (select s.id from scope s order by s.created_at, s.detail desc, s.id limit 1)
    ) as guardian_id
  ),
  own as (
    select lower(c.email) as email
    from contacts c
    where c.id = p_contact and c.email is not null and c.email <> ''
  ),
  headline as (
    -- their own address wins outright; the primary only stands in for it
    select o.email, 'own' as why from own o
    union all
    select lower(e.email), 'primary'
    from guardian_emails e
    join chosen ch on ch.guardian_id = e.guardian_id
    where not exists (select 1 from own)
      and e.id = (select e2.id from guardian_emails e2
                   where e2.guardian_id = ch.guardian_id
                   order by e2.created_at, e2.id limit 1)
  ),
  copies as (
    select lower(e.email) as email, 'always copy' as why
    from guardian_emails e
    join scope s on s.id = e.guardian_id
    where e.always_copy
  )
  -- headline first, and never the same address twice however it qualified
  select x.email, min(x.why) as why
  from (select * from headline union all select * from copies) x
  group by x.email
  order by (min(x.why) = 'always copy'), x.email;
$$;

revoke all on function public.contact_send_list(uuid) from public;
grant execute on function public.contact_send_list(uuid) to authenticated, service_role;

-- a look at what it says for the family that started all this
select c.first_name||' '||c.last_name as participant,
       (select string_agg(l.email||' ('||l.why||')', ', ')
          from public.contact_send_list(c.id) l) as goes_to
from contacts c
where c.last_name = 'Allen' and c.first_name in ('Luther','Emerson')
   or c.first_name = 'Belle';
