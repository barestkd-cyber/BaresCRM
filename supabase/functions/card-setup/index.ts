// ===========================================================================
// Supabase Edge Function: card-setup - save a card from the public site
// ---------------------------------------------------------------------------
// Owner, 2026-08-23: "start on webpage for update card. Add name and email
// fields and then match that to email in CRM to shoot it over?"
//
// PUBLIC, gated by the link's token. He corrected an earlier open version of
// this: "the link knows the profile it was sent from and person sent to, so
// if the email doesn't match it goes to the profile the link was sent from
// under the participant until I can match it to a guardian."
//
// That is better in two ways. A card that arrives lands somewhere real rather
// than on a guardian invented for a typo. And with a token there is no way to
// probe which addresses the studio knows, because the page will not work
// without one.
//
// WHERE A CARD GOES, in order: the guardian whose address they typed; failing
// that, whoever the link was sent to; failing that, the participant whose
// profile sent it. The last two are flagged needs_matching so staff see them.
//
// It still says nothing about who anybody is. The response is a client secret
// and nothing else - no name, no children, no other cards - and it never
// reports whether an address was recognised.
//
// The card itself is typed into Stripe's own iframe on the site and confirmed
// by the browser against Stripe. It never reaches this function.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy card-setup --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function stripe(path: string, key: string, form?: URLSearchParams, method = "POST") {
  const res = await fetch("https://api.stripe.com/v1/" + path, {
    method,
    headers: {
      "Authorization": "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? (form ?? new URLSearchParams()) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || ("Stripe " + res.status));
  return body;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const pubKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
    if (!secretKey || !pubKey) return json({ error: "Card saving is not set up yet." }, 503, cors);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    if (str(body.action) === "config") return json({ publishable_key: pubKey }, 200, cors);

    // The token says which profile sent this and who it was sent to. Without
    // one there is nothing to fall back on and no way to tell a real visitor
    // from somebody probing which addresses the studio knows.
    const token = str(body.token);
    if (!/^[0-9a-f]{32}$/i.test(token)) return json({ error: "That link is not valid." }, 400, cors);
    const inv = await admin.from("card_invites").select("*").eq("token", token).maybeSingle();
    if (inv.error) { console.error("invite read", inv.error); return json({ error: "Could not open that link." }, 500, cors); }
    if (!inv.data) return json({ error: "That link is not valid." }, 404, cors);
    if (new Date(inv.data.expires_at).getTime() < Date.now()) {
      return json({ error: "expired", message: "This link has expired. Ask the studio for a new one." }, 410, cors);
    }

    const name = str(body.name).slice(0, 120);
    const email = str(body.email).toLowerCase().slice(0, 200);
    if (!name) return json({ error: "Please give your name." }, 400, cors);
    if (!EMAIL_RE.test(email)) return json({ error: "That does not look like an email address." }, 400, cors);
    // A honeypot the site fills with nothing. Bots fill everything.
    if (str(body.hp)) return json({ error: "Please try again." }, 400, cors);

    // Who this is, if the studio already knows them. The answer never leaves
    // this function.
    const hit = await admin.from("guardian_emails")
      .select("guardian_id").eq("email", email).maybeSingle();
    let guardianId = str(hit.data?.guardian_id);

    // The address matched nobody. Fall back to who the link was SENT to, and
    // failing that to the participant whose profile sent it - the card lands
    // somewhere real either way, flagged so staff can move it to the right
    // person. Inventing a guardian for a typo would have made a stranger.
    let fellBack = false;
    if (!guardianId && inv.data.guardian_id) {
      guardianId = String(inv.data.guardian_id);
      fellBack = true;
    }

    let cust = "";
    if (guardianId) {
      const g = await admin.from("guardians")
        .select("id,name,stripe_customer_id").eq("id", guardianId).single();
      cust = str(g.data?.stripe_customer_id);
      if (!cust) {
        const cf = new URLSearchParams();
        cf.set("email", email);
        cf.set("name", str(g.data?.name) || name);
        cf.set("metadata[guardian_id]", guardianId);
        const made = await stripe("customers", secretKey, cf);
        cust = str(made.id);
        await admin.from("guardians").update({ stripe_customer_id: cust }).eq("id", guardianId);
      }
      // A name the studio never had is worth keeping; one it already has is
      // not worth overwriting from a public form.
      if (!str(g.data?.name) && name) {
        await admin.from("guardians").update({ name }).eq("id", guardianId).is("name", null);
      }
    } else {
      // Nobody to attach it to at all: it goes on the PARTICIPANT whose
      // profile sent the link, which is where staff will be looking.
      const c = await admin.from("contacts")
        .select("id,first_name,last_name,stripe_customer_id").eq("id", inv.data.contact_id).single();
      cust = str(c.data?.stripe_customer_id);
      if (!cust) {
        const cf = new URLSearchParams();
        cf.set("email", email);
        cf.set("name", name);
        cf.set("metadata[contact_id]", String(inv.data.contact_id));
        const made = await stripe("customers", secretKey, cf);
        cust = str(made.id);
        await admin.from("contacts")
          .update({ stripe_customer_id: cust }).eq("id", inv.data.contact_id);
      }
      fellBack = true;
    }

    const sf = new URLSearchParams();
    sf.set("customer", cust);
    sf.set("payment_method_types[]", "card");
    // Saved so staff can charge it later with nobody present.
    sf.set("usage", "off_session");
    const si = await stripe("setup_intents", secretKey, sf);

    // Spent, and recorded where it went. needs_matching is what puts an
    // unrecognised address in front of staff instead of losing it.
    await admin.from("card_invites").update({
      used_at: new Date().toISOString(),
      landed_on: guardianId || null,
      needs_matching: fellBack,
    }).eq("id", inv.data.id);

    // A client secret and nothing else. Whether they were recognised, who
    // they are, what else is on the account: none of it goes back.
    return json({ client_secret: str(si.client_secret), publishable_key: pubKey }, 200, cors);
  } catch (e) {
    console.error("card-setup", e);
    return json({ error: "Something went wrong. Please call the studio." }, 500, cors);
  }
});
