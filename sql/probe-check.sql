select i.id as invite, i.membership_id,
       (select count(*) from membership_agreements a
         where a.membership_id = i.membership_id and a.status='signed') as signed_already
from agreement_invites i where i.token = 'ffffffffffffffffffffffffffffff01';
