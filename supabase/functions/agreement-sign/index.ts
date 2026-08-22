// ===========================================================================
// Supabase Edge Function: agreement-sign - sign an agreement from a link
// ---------------------------------------------------------------------------
// Owner, 2026-08-21: "instead of them filling out the information on a
// checkout page, it would already be prefilled and they would just review it
// and then sign."
//
// PUBLIC, addressed by bearer token, like receipt-view:
//   POST { action: "view", token }  -> the frozen document, ready to render
//   POST { action: "sign", token, signer_name, ... } -> files the agreement
//
// THE DOCUMENT IS NOT BUILT HERE. It was frozen when the invite was created,
// so what they read and sign is exactly what was on the studio's screen when
// it was sent. This function renders nothing and prices nothing.
//
// The token is the entire gate: 128 bits, one document, expires, and spent
// the moment it is used. It grants nothing else.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy agreement-sign --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// The signing page is on the public site, not the CRM.
const ALLOWED_ORIGINS = [
  "https://www.barestkd.fit",
  "https://barestkd.fit",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(obj: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const TOKEN_RE = /^[0-9a-f]{32}$/i;

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const action = str(body.action);
    const token = str(body.token);
    if (!TOKEN_RE.test(token)) return json({ error: "That link is not valid." }, 400, cors);

    const inv = await admin.from("agreement_invites").select("*").eq("token", token).maybeSingle();
    if (inv.error) { console.error("invite read", inv.error); return json({ error: "Could not open that link." }, 500, cors); }
    if (!inv.data) return json({ error: "That link is not valid." }, 404, cors);
    const iv = inv.data;

    if (iv.revoked_at) {
      // An invite is retired for two very different reasons: somebody signed
      // at the desk in the meantime, or the studio replaced it. Telling a
      // customer their agreement was withdrawn when they in fact already
      // signed it would send them back to the studio for nothing.
      const done = await admin.from("membership_agreements")
        .select("id").eq("membership_id", iv.membership_id).eq("status", "signed").maybeSingle();
      return done.data
        ? json({ error: "signed", message: "This agreement has already been signed. Thank you." }, 410, cors)
        : json({ error: "gone", message: "A newer copy of this agreement was sent. Please use the most recent link, or contact the studio." }, 410, cors);
    }
    if (iv.signed_at) return json({ error: "signed", message: "This agreement has already been signed. Thank you." }, 410, cors);
    if (new Date(iv.expires_at).getTime() < Date.now()) {
      return json({ error: "expired", message: "This link has expired. Ask the studio to send a new one." }, 410, cors);
    }

    if (action === "view") {
      return json({
        title: iv.document_title,
        program: iv.program,
        html: iv.body_html,
        signer_hint: iv.signer_hint || "",
        is_minor: !!iv.is_minor,
        participant_name: iv.participant_name || "",
      }, 200, cors);
    }

    if (action === "sign") {
      const signer = str(body.signer_name);
      const rel = str(body.signer_relationship);
      const png = str(body.signature_png);
      if (!signer) return json({ error: "Type the name of whoever is signing." }, 400, cors);
      // No guardian field here on purpose. A minor's guardian is named INSIDE
      // the frozen document, put there when the invite was made, so the words
      // they read are the words they sign. Collecting a name at this end would
      // mean the signed page and the stored document disagreed.
      if (!png.startsWith("data:image/png;base64,")) return json({ error: "Sign in the box before submitting." }, 400, cors);
      // A pad drawn on is a few kB; anything near a megabyte is not a
      // signature, and the column is not a file store.
      if (png.length > 400000) return json({ error: "That signature image is too large." }, 400, cors);

      // The membership must still be there, and still unpapered. Someone may
      // have signed at the desk between the send and the click.
      const already = await admin.from("membership_agreements")
        .select("id").eq("membership_id", iv.membership_id).eq("status", "signed").maybeSingle();
      if (already.data) {
        await admin.from("agreement_invites")
          .update({ revoked_at: new Date().toISOString() }).eq("id", iv.id).is("signed_at", null);
        return json({ error: "signed", message: "This agreement has already been signed. Thank you." }, 410, cors);
      }

      // CLAIM THE INVITE FIRST. Two taps on a slow phone would otherwise file
      // two agreements for one membership; only the update that actually
      // changes a row from unsigned gets to write.
      const claim = await admin.from("agreement_invites")
        .update({ signed_at: new Date().toISOString() })
        .eq("id", iv.id).is("signed_at", null).is("revoked_at", null)
        .select("id");
      if (claim.error) { console.error("invite claim", claim.error); return json({ error: "Could not save that." }, 500, cors); }
      if (!claim.data || !claim.data.length) {
        return json({ error: "signed", message: "This agreement has already been signed. Thank you." }, 410, cors);
      }

      const ins = await admin.from("membership_agreements").insert({
        membership_id: iv.membership_id,
        contact_id: iv.contact_id,
        program: iv.program,
        plan_code: iv.plan_code,
        template_key: iv.template_key,
        template_version: iv.template_version,
        document_title: iv.document_title,
        body_json: iv.body_json,
        body_text: iv.body_text,
        down_cents: iv.down_cents,
        recurring_cents: iv.recurring_cents,
        pif_cents: iv.pif_cents,
        agreed_payment_date: iv.agreed_payment_date,
        signer_name: signer,
        signer_relationship: rel || null,
        signer_initials: iv.body_json?.initials || null,
        signature_png: png,
        signed_at: new Date().toISOString(),
        signed_with_staff: "signed online",
        user_agent: str(req.headers.get("User-Agent")).slice(0, 300),
      }).select("id").single();
      if (ins.error || !ins.data) {
        console.error("agreement insert", ins.error);
        // Hand the invite back rather than stranding it claimed-but-unsigned,
        // which would leave them holding a dead link and no agreement.
        await admin.from("agreement_invites").update({ signed_at: null }).eq("id", iv.id);
        return json({ error: "Could not save that. Please try again." }, 500, cors);
      }
      await admin.from("agreement_invites")
        .update({ agreement_id: ins.data.id }).eq("id", iv.id);

      // Whoever signed for a minor is that child's guardian, which is the same
      // relationship the parent portal runs on. Best effort: it must never cost
      // the signature, which is already filed by this point. 23505 means they
      // were already linked, which is a success as far as this is concerned.
      if (iv.is_minor && iv.sent_to) {
        const link = await admin.from("student_guardians")
          .insert({ student_id: iv.contact_id, email: iv.sent_to, label: "Guardian" });
        if (link.error && String(link.error.code) !== "23505") console.error("guardian link", link.error);
      }

      return json({ ok: true, title: iv.document_title }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (e) {
    console.error("agreement-sign", e);
    return json({ error: "Something went wrong. Please contact the studio." }, 500, cors);
  }
});
