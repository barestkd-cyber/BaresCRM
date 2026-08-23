-- ===========================================================================
-- Everyone a contact shares a household with
-- ---------------------------------------------------------------------------
-- Needed on the server, where a card may be charged. A card belongs to the
-- family - Carlton's is on Emerson's contact and pays for Luther - so
-- charge-saved has to know who counts as family without trusting the browser
-- to tell it.
-- ===========================================================================

create or replace function public.household_contact_ids(p_contact uuid)
returns table (contact_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select hm2.contact_id
  from household_members hm1
  join household_members hm2 on hm2.household_id = hm1.household_id
  where hm1.contact_id = p_contact
  union
  select p_contact;
$$;

revoke all on function public.household_contact_ids(uuid) from public;
grant execute on function public.household_contact_ids(uuid) to authenticated, service_role;

select c.first_name||' '||c.last_name as who,
       (select count(*) from public.household_contact_ids(c.id)) as family_size
from contacts c where c.last_name = 'Allen' and c.first_name in ('Luther','Emerson','Oliver');
