-- Remove the throwaway invite used to exercise the public signing path.
delete from public.agreement_invites
where token = 'ffffffffffffffffffffffffffffff01'
returning id, document_title;

select count(*) as invites_left from public.agreement_invites;
