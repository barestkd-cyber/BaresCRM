-- Owner, 2026-08-30: "get rid of it - former memberships are to keep track
-- of real agreements, not failures of the system." The 8/26 Cody Mogle
-- agreement came from the fake-success checkout bug, not a real enrollment.
delete from public.membership_agreements
 where id = 'e98fe77e-8085-4b90-8090-78d0721f7026';

select coalesce(a.signed_at::date::text,'?') as signed,
       a.document_title, coalesce(a.membership_id::text,'no mem link') as mem
  from public.membership_agreements a
 where a.contact_id = 'a32e5fbb-b9a6-49a2-85e9-9f1eb83e3f44';
