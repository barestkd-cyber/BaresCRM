// ===========================================================================
// Supabase Edge Function: payment-methods - the cards a member has on file
// ---------------------------------------------------------------------------
// Owner, 2026-08-21: "payment methods on file should be under invoices and
// payments... I can delete cards from Stripe from there... send a link to
// update the card on Stripe."
//
// STRIPE IS THE ONLY RECORD. The studio never stores a card, not even a
// last-four, so this reads Stripe live every time. A card removed here is
// removed there, which is why remove refuses while scheduled payments still
// point at it: those payments would have nothing to charge.
//
// FOUR ACTIONS, all staff-only (deployed WITH JWT verification + is_staff):
//   list    -> the contact's cards, which is default, and how many scheduled
//              payments ride on each one.
//   default -> set the customer's default card. Anything scheduled without a
//              card of its own follows this.
//   remove  -> detach from Stripe. Blocked while payments point at it unless
//              the caller has been told the count and says so anyway.
//   link    -> a Stripe-hosted page to add or replace a card, emailed to the
//              payer. Card details go from their browser to Stripe; the studio
//              never touches them, and neither does this function.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy payment-methods
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
// Stripe ids are opaque, but they are never arbitrary text. Refusing anything
// else keeps a typo or a hostile string out of a URL path.
const PM_RE = /^pm_[A-Za-z0-9]+$/;

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

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secretKey) return json({ error: "STRIPE_SECRET_KEY not configured" }, 500, cors);

    // ── staff only. The JWT is verified by the platform; this checks ROLE. ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const staff = await asUser.rpc("is_staff");
    if (staff.error || staff.data !== true) return json({ error: "Staff only." }, 403, cors);

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = str(body.action);
    const contactId = str(body.contact_id);
    if (!UUID_RE.test(contactId)) return json({ error: "Which person?" }, 400, cors);
    // list may span a household: a card belongs to the family, not to
    // whichever child was on the invoice when it was saved. Every id is
    // checked, so a caller cannot read a stranger's cards by adding one.
    const alsoRaw: unknown[] = Array.isArray(body.contact_ids) ? body.contact_ids : [];
    const alsoIds = [...new Set(alsoRaw.map((x) => str(x)).filter((x) => UUID_RE.test(x) && x !== contactId))]
      .slice(0, 20);

    const { data: person, error: pErr } = await admin.from("contacts")
      .select("id,first_name,last_name,email,stripe_customer_id")
      .eq("id", contactId).maybeSingle();
    if (pErr) { console.error("contact", pErr); return json({ error: "Could not read that person" }, 500, cors); }
    if (!person) return json({ error: "No such person" }, 404, cors);

    const name = [str(person.first_name), str(person.last_name)].filter(Boolean).join(" ") || "there";
    const custId = str(person.stripe_customer_id);

    // ── how many scheduled payments ride on each card ─────────────────────
    // Not just this person's memberships: whatever they PAY FOR. A parent's
    // card carries their children's payments, and removing it would strand
    // those, not the parent's own.
    async function usage(): Promise<Record<string, number>> {
      const mems = await admin.from("memberships")
        .select("id,payment_method_id")
        .or("payer_contact_id.eq." + contactId + ",and(payer_contact_id.is.null,contact_id.eq." + contactId + ")");
      const byMem: Record<string, string> = {};
      (mems.data || []).forEach((m: Record<string, unknown>) => { byMem[String(m.id)] = str(m.payment_method_id); });
      const ids = Object.keys(byMem);
      const out: Record<string, number> = {};
      if (!ids.length) return out;
      const insts = await admin.from("membership_installments")
        .select("membership_id,payment_method_id,status")
        .in("membership_id", ids).eq("status", "scheduled");
      (insts.data || []).forEach((r: Record<string, unknown>) => {
        // A payment with no card of its own rides on the membership's.
        const pm = str(r.payment_method_id) || byMem[String(r.membership_id)];
        if (pm) out[pm] = (out[pm] || 0) + 1;
      });
      return out;
    }

    // ── list ──────────────────────────────────────────────────────────────
    if (action === "list") {
      // Everyone whose cards count here: the person asked about, plus anybody
      // else the caller named (their household), plus the GUARDIANS of all of
      // them - a parent's cards belong to the parent, not to whichever child
      // their email happened to match when they first paid.
      const holders: { id: string; name: string; cust: string; guardian?: string }[] =
        [{ id: contactId, name, cust: custId }];
      const family = [contactId, ...alsoIds];
      if (alsoIds.length) {
        const more = await admin.from("contacts")
          .select("id,first_name,last_name,stripe_customer_id")
          .in("id", alsoIds).not("stripe_customer_id", "is", null);
        for (const m of (more.data || []) as Record<string, unknown>[]) {
          holders.push({
            id: String(m.id),
            name: [str(m.first_name), str(m.last_name)].filter(Boolean).join(" "),
            cust: str(m.stripe_customer_id),
          });
        }
      }
      const gRows = await admin.from("student_guardians")
        .select("guardians(id,name,stripe_customer_id,guardian_emails(email))")
        .in("student_id", family);
      const guardians: Record<string, any>[] = [];
      const seenG = new Set<string>();
      for (const row of (gRows.data || []) as Record<string, any>[]) {
        const gg = row.guardians;
        if (!gg || seenG.has(gg.id)) continue;
        seenG.add(gg.id);
        guardians.push(gg);
        if (gg.stripe_customer_id && !holders.some((h) => h.cust === gg.stripe_customer_id)) {
          holders.push({ id: contactId, name: str(gg.name), cust: str(gg.stripe_customer_id), guardian: gg.id });
        }
      }
      const cards: Record<string, unknown>[] = [];
      for (const h of holders) {
        if (!h.cust) continue;
        const cust = await stripe("customers/" + encodeURIComponent(h.cust), secretKey, undefined, "GET")
          .catch(() => null);
        const defPm = str(cust?.invoice_settings?.default_payment_method);
        // WHOSE CARD, not which contact record holds the Stripe customer.
        // Every checkout sets the customer name to the adult who paid, so
        // Stripe already knows this is Carlton and not his seven-year-old
        // daughter, whose contact the customer happens to hang off.
        const payerName = str(cust?.name) || h.name;
        // The address the card was given under. A Stripe customer hangs off a
        // CHILD's contact but was created with the paying adult's email, so
        // this is what ties a card back to a guardian.
        const payerEmail = str(cust?.email).toLowerCase();
        const pms = await stripe(
          "payment_methods?customer=" + encodeURIComponent(h.cust) + "&type=card&limit=20",
          secretKey, undefined, "GET",
        ).catch(() => null);
        const rows = (pms?.data || []).map((p: Record<string, any>) => ({
          id: p.id,
          brand: p.card?.brand || "card",
          last4: p.card?.last4 || "",
          exp: (p.card?.exp_month ? String(p.card.exp_month).padStart(2, "0") : "??")
            + "/" + (p.card?.exp_year ? String(p.card.exp_year).slice(-2) : "??"),
          // Stripe's own default wins; with none set, the newest card is what
          // an off_session charge would actually pick, so say so honestly.
          def: defPm ? p.id === defPm : false,
          owner_contact_id: h.id,
          owner_name: payerName,
          owner_email: payerEmail,
          borrowed: h.id !== contactId,
        }));
        if (rows.length && !rows.some((c: Record<string, unknown>) => c.def)) rows[0].def = true;
        cards.push(...rows);

        // ADOPTION. A Stripe customer created at checkout carries the paying
        // adult's address, and so does their guardian record, so the two can
        // be matched on it. Done here rather than as a migration because it
        // is self-healing: any customer that turns up later is claimed the
        // first time its family's cards are listed.
        if (payerEmail && !h.guardian) {
          const owner = guardians.find((gg) =>
            !gg.stripe_customer_id
            && (gg.guardian_emails || []).some((e: Record<string, unknown>) =>
              str(e.email).toLowerCase() === payerEmail));
          if (owner) {
            const claim = await admin.from("guardians")
              .update({ stripe_customer_id: h.cust })
              .eq("id", owner.id).is("stripe_customer_id", null);
            // A unique index means two guardians cannot claim one customer.
            // Losing the race is fine: somebody already owns it.
            if (claim.error) console.error("adopt customer", claim.error);
            else owner.stripe_customer_id = h.cust;
          }
        }
      }
      // THE FAMILY DEFAULT. His override if he set one; otherwise the primary
      // contact's card, because he has already said who that is and one
      // decision doing two jobs is one less thing left unset.
      let familyDefault = "";
      const hhRow = await admin.from("household_members")
        .select("households(id,primary_guardian_id,default_payment_method)")
        .eq("contact_id", contactId).maybeSingle();
      const hh = (hhRow.data as Record<string, any> | null)?.households ?? null;
      if (hh) {
        const override = str(hh.default_payment_method);
        if (override && cards.some((c) => c.id === override)) {
          familyDefault = override;
        } else if (hh.primary_guardian_id) {
          // Which addresses the primary contact answers to, so their card can
          // be picked out of a family's several.
          const mail = await admin.from("guardian_emails")
            .select("email").eq("guardian_id", hh.primary_guardian_id);
          const theirs = new Set((mail.data ?? []).map((m: Record<string, unknown>) => str(m.email).toLowerCase()));
          // Their Stripe default first, then any card of theirs at all.
          const mine = cards.filter((c) => theirs.has(String(c.owner_email || "")));
          const pick = mine.find((c) => c.def) ?? mine[0];
          if (pick) familyDefault = String(pick.id);
        }
      }
      cards.forEach((c) => { c.family_default = familyDefault ? c.id === familyDefault : false; });

      // The family's card leads, then the profile's own, then the rest.
      cards.sort((a, b) =>
        Number(!!b.family_default) - Number(!!a.family_default)
        || Number(a.borrowed) - Number(b.borrowed));
      return json({ cards, usage: await usage(), email: str(person.email),
                    family_default: familyDefault || null }, 200, cors);
    }

    // ── default ───────────────────────────────────────────────────────────
    if (action === "default") {
      const pm = str(body.payment_method_id);
      if (!PM_RE.test(pm)) return json({ error: "Which card?" }, 400, cors);
      if (!custId) return json({ error: "No Stripe customer for that person" }, 400, cors);
      // The card must already belong to this customer. Without this check a
      // caller could point one person's customer at another person's card.
      const owned = await stripe("payment_methods/" + encodeURIComponent(pm), secretKey, undefined, "GET");
      if (str(owned.customer) !== custId) return json({ error: "That card is not on this account" }, 400, cors);
      const form = new URLSearchParams();
      form.set("invoice_settings[default_payment_method]", pm);
      await stripe("customers/" + encodeURIComponent(custId), secretKey, form);
      return json({ ok: true }, 200, cors);
    }

    // ── family-default ────────────────────────────────────────────────────
    // His override. Distinct from Stripe's per-customer default, which only
    // decides which card Stripe reaches for within ONE customer and knows
    // nothing about families.
    if (action === "family-default") {
      const pm = str(body.payment_method_id);
      if (pm && !PM_RE.test(pm)) return json({ error: "Which card?" }, 400, cors);
      const row = await admin.from("household_members")
        .select("household_id").eq("contact_id", contactId).maybeSingle();
      const hid = str(row.data?.household_id);
      if (!hid) return json({ error: "That person is not in a household." }, 409, cors);
      // An empty value clears the override and hands the decision back to the
      // primary contact, which is the sane way out of a wrong choice.
      const upd = await admin.from("households")
        .update({ default_payment_method: pm || null }).eq("id", hid);
      if (upd.error) { console.error("family default", upd.error); return json({ error: "Could not set that" }, 500, cors); }
      return json({ ok: true, cleared: !pm }, 200, cors);
    }

    // ── remove ────────────────────────────────────────────────────────────
    if (action === "remove") {
      const pm = str(body.payment_method_id);
      if (!PM_RE.test(pm)) return json({ error: "Which card?" }, 400, cors);
      if (!custId) return json({ error: "No Stripe customer for that person" }, 400, cors);
      const owned = await stripe("payment_methods/" + encodeURIComponent(pm), secretKey, undefined, "GET");
      if (str(owned.customer) !== custId) return json({ error: "That card is not on this account" }, 400, cors);

      const uses = (await usage())[pm] || 0;
      // The count is checked HERE, not trusted from the browser. The client
      // may confirm past it, but only after being told the real number.
      if (uses && body.confirm_uses !== uses) {
        return json({ error: "in_use", uses }, 409, cors);
      }
      await stripe("payment_methods/" + encodeURIComponent(pm) + "/detach", secretKey);
      // Anything pointed at the dead card falls back to the account default
      // rather than keeping a reference to a card that no longer exists.
      await admin.from("membership_installments").update({ payment_method_id: null }).eq("payment_method_id", pm);
      await admin.from("memberships").update({ payment_method_id: null }).eq("payment_method_id", pm);
      return json({ ok: true, released: uses }, 200, cors);
    }

    // ── link ──────────────────────────────────────────────────────────────
    // A Stripe Checkout session in setup mode: their browser to Stripe, no
    // card data anywhere near the studio or this function.
    if (action === "link") {
      // WHO IS BEING ASKED FOR A CARD. A child has no card; the adult who pays
      // for them does. Named explicitly, or the household's primary contact,
      // or the participant themselves when they are their own payer.
      let gid = str(body.guardian_id);
      if (!gid) {
        const hhRow = await admin.from("household_members")
          .select("households(primary_guardian_id)").eq("contact_id", contactId).maybeSingle();
        gid = str((hhRow.data as Record<string, any> | null)?.households?.primary_guardian_id);
      }
      if (!gid) {
        const only = await admin.from("student_guardians")
          .select("guardian_id").eq("student_id", contactId).limit(2);
        if ((only.data || []).length === 1) gid = str(only.data![0].guardian_id);
      }

      let payer: Record<string, any> | null = null;
      if (gid) {
        const gRes = await admin.from("guardians")
          .select("id,name,stripe_customer_id,guardian_emails(email)").eq("id", gid).maybeSingle();
        payer = gRes.data as Record<string, any> | null;
      }

      // The address the link goes to, and the account the card lands on.
      const to = str(body.email)
        || (payer ? str((payer.guardian_emails || [])[0]?.email) : "")
        || str(person.email);
      if (!to) {
        return json({ error: payer
          ? "No email address for " + (str(payer.name) || "that guardian")
          : "Nobody on this profile has an email address to send to" }, 400, cors);
      }

      // Attach to the PARENT's customer, so the new card joins the ones they
      // already have instead of starting a second pile under a child's name.
      let cust = payer ? str(payer.stripe_customer_id) : "";
      if (!cust && !payer) cust = custId;
      if (!cust) {
        const cf = new URLSearchParams();
        cf.set("email", to);
        cf.set("name", payer ? (str(payer.name) || name) : name);
        cf.set("metadata[contact_id]", contactId);
        if (payer) cf.set("metadata[guardian_id]", String(payer.id));
        const made = await stripe("customers", secretKey, cf);
        cust = str(made.id);
        if (payer) await admin.from("guardians").update({ stripe_customer_id: cust }).eq("id", payer.id);
        else await admin.from("contacts").update({ stripe_customer_id: cust }).eq("id", contactId);
      }
      const sf = new URLSearchParams();
      sf.set("mode", "setup");
      sf.set("customer", cust);
      sf.set("payment_method_types[0]", "card");
      sf.set("success_url", "https://www.barestkd.fit/card-saved/");
      sf.set("cancel_url", "https://www.barestkd.fit/");
      sf.set("metadata[contact_id]", contactId);
      const sess = await stripe("checkout/sessions", secretKey, sf);
      const link = str(sess.url);
      if (!link) return json({ error: "Stripe did not return a link" }, 502, cors);

      if (body.send === false) return json({ ok: true, url: link, sent: false }, 200, cors);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ ok: true, url: link, sent: false, error: "RESEND_API_KEY not configured" }, 200, cors);
      const html = '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;'
        + 'margin:0 auto;padding:28px 22px;color:#1E1B18">'
        + '<h2 style="margin:0 0 14px;font-size:21px">Update your card</h2>'
        + '<p style="margin:0 0 18px;line-height:1.6">Hi ' + esc(name) + ', here is a secure link to add or '
        + 'replace the card we keep on file for your Bares Taekwondo payments.</p>'
        + '<p style="margin:0 0 22px"><a href="' + esc(link) + '" style="display:inline-block;background:#1E1B18;'
        + 'color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:600">Update card</a></p>'
        + '<p style="margin:0;font-size:13px;color:#6B655F;line-height:1.6">The page is hosted by Stripe. '
        + 'We never see your card number. The link expires in 24 hours.</p></div>';
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Bares Taekwondo <receipts@barestkd.fit>",
          to: [to],
          subject: "Update your card on file",
          html,
        }),
      });
      if (!sent.ok) {
        const detail = await sent.text().catch(() => "");
        console.error("resend failed", sent.status, detail);
        // The link is good even when the email is not. Hand it back so staff
        // can pass it on rather than losing the session entirely.
        return json({ ok: true, url: link, sent: false, error: "Email send failed" }, 200, cors);
      }
      return json({ ok: true, url: link, sent: true, to }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (e) {
    console.error("payment-methods", e);
    return json({ error: String((e as Error)?.message || e) }, 500, cors);
  }
});
