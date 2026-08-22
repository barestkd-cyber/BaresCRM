// ===========================================================================
// Supabase Edge Function: send-agreement - email somebody their agreement
// ---------------------------------------------------------------------------
// Owner, 2026-08-21: "send digital agreement... instead of them filling out
// the information on a checkout page, it would already be prefilled and they
// would just review it and then sign."
//
// The CRM builds the document, exactly as it does for signing at the desk,
// and hands the finished thing here. This function freezes it into an invite,
// mints the token, and emails the link. It never renders or prices anything,
// so the copy they read at home cannot differ from the copy on the screen.
//
// STAFF ONLY (deployed WITH JWT verification + is_staff). The public half is
// agreement-sign, which is the only thing that ever reads a token.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy send-agreement
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://crm.barestkd.fit",
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 128 bits of hex, same shape as pos_sales.view_token. */
function mintToken(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const staff = await asUser.rpc("is_staff");
    if (staff.error || staff.data !== true) return json({ error: "Staff only." }, 403, cors);

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const membershipId = str(body.membership_id);
    if (!UUID_RE.test(membershipId)) return json({ error: "Which membership?" }, 400, cors);
    const to = str(body.email).toLowerCase();
    if (!EMAIL_RE.test(to)) return json({ error: "That is not an email address." }, 400, cors);

    const doc = body.document ?? {};
    const need = ["program", "template_key", "template_version", "document_title", "body_json", "body_text", "body_html"];
    for (const k of need) {
      if (!doc[k]) return json({ error: "The document did not come through (" + k + ")." }, 400, cors);
    }
    // A document the size of a photo is not a document. The agreements run to
    // tens of kB; this is a sanity bound, not a business rule.
    if (String(doc.body_html).length > 400000 || String(doc.body_text).length > 200000) {
      return json({ error: "That document is too large to send." }, 400, cors);
    }

    const ms = await admin.from("memberships")
      .select("id,contact_id,status").eq("id", membershipId).maybeSingle();
    if (ms.error || !ms.data) return json({ error: "No such membership." }, 404, cors);

    // Already papered? Sending would invite a second live agreement for one
    // membership, and then nobody could say which is the deal.
    const signed = await admin.from("membership_agreements")
      .select("id").eq("membership_id", membershipId).eq("status", "signed").maybeSingle();
    if (signed.data) return json({ error: "That membership already has a signed agreement." }, 409, cors);

    // One live invite at a time. An older link still in an inbox would file a
    // second agreement if it were clicked after this one, so it is retired
    // here rather than left to race.
    await admin.from("agreement_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("membership_id", membershipId).is("signed_at", null).is("revoked_at", null);

    const token = mintToken();
    const ins = await admin.from("agreement_invites").insert({
      membership_id: membershipId,
      contact_id: ms.data.contact_id,
      token,
      sent_to: to,
      program: str(doc.program),
      plan_code: str(doc.plan_code) || null,
      template_key: str(doc.template_key),
      template_version: str(doc.template_version),
      document_title: str(doc.document_title),
      body_json: doc.body_json,
      body_text: String(doc.body_text),
      body_html: String(doc.body_html),
      down_cents: doc.down_cents ?? null,
      recurring_cents: doc.recurring_cents ?? null,
      pif_cents: doc.pif_cents ?? null,
      agreed_payment_date: str(doc.agreed_payment_date) || null,
      signer_hint: str(doc.signer_hint) || null,
      is_minor: !!doc.is_minor,
      participant_name: str(doc.participant_name) || null,
      created_by: str(body.staff_email) || null,
    }).select("id,expires_at").single();
    if (ins.error || !ins.data) {
      console.error("invite insert", ins.error);
      return json({ error: "Could not create the agreement link." }, 500, cors);
    }

    const link = "https://www.barestkd.fit/sign/?t=" + token;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      // The invite is real even with no mailer configured, so hand the link
      // back rather than throwing away a document that is already stored.
      return json({ ok: true, url: link, sent: false, error: "RESEND_API_KEY not configured" }, 200, cors);
    }
    const who = str(doc.participant_name);
    const title = str(doc.document_title);
    const html = '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:540px;'
      + 'margin:0 auto;padding:28px 22px;color:#1E1B18">'
      + '<h2 style="margin:0 0 14px;font-size:21px">Your membership agreement</h2>'
      + '<p style="margin:0 0 16px;line-height:1.6">'
      + (who ? esc(who) + "'s " : "Your ") + esc(title)
      + ' is ready to sign. Everything is already filled in. Read it through, '
      + 'type your name, sign at the bottom, and you are done.</p>'
      + '<p style="margin:0 0 22px"><a href="' + esc(link) + '" style="display:inline-block;background:#1E1B18;'
      + 'color:#fff;text-decoration:none;padding:13px 24px;border-radius:9px;font-weight:600">Read and sign</a></p>'
      + '<p style="margin:0;font-size:13px;color:#6B655F;line-height:1.6">Nothing is charged on that page. '
      + 'The link is good for 14 days; if it expires, ask us for a new one.<br>'
      + 'Bares Taekwondo Fitness · 903-561-2966</p></div>';
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Bares Taekwondo <receipts@barestkd.fit>",
        to: [to],
        subject: title || "Your membership agreement",
        html,
      }),
    });
    if (!sent.ok) {
      const detail = await sent.text().catch(() => "");
      console.error("resend failed", sent.status, detail);
      return json({ ok: true, url: link, sent: false, error: "Email send failed" }, 200, cors);
    }
    return json({ ok: true, url: link, sent: true, to, expires_at: ins.data.expires_at }, 200, cors);
  } catch (e) {
    console.error("send-agreement", e);
    return json({ error: String((e as Error)?.message || e) }, 500, cors);
  }
});
