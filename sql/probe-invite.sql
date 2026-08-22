-- A throwaway invite against a real membership, so the public view path can be
-- exercised without touching money or paperwork. Signing is NOT tested here:
-- that would file a real agreement. Revoked at the end of the probe.
insert into public.agreement_invites (
  membership_id, contact_id, token, sent_to,
  program, template_key, template_version, document_title,
  body_json, body_text, body_html, is_minor, participant_name, signer_hint
)
select m.id, m.contact_id, 'ffffffffffffffffffffffffffffff01', 'probe@example.invalid',
       m.program, 'probe', 'v0', 'PROBE - not a real agreement',
       '{"probe":true}'::jsonb, 'probe body', '<div class="agr-doc">probe body</div>',
       false, 'Probe Student', 'Probe Signer'
from public.memberships m
order by m.created_at desc
limit 1
returning id, token;
