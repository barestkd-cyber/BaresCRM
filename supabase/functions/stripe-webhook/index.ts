// ===========================================================================
// Supabase Edge Function: stripe-webhook
// ---------------------------------------------------------------------------
// The ONLY thing that marks a Stripe-paid invoice paid. Public and
// unauthenticated by design - the Stripe signature is the entire gate.
//
// HARD RULES:
//   1. Deploy --no-verify-jwt (Stripe cannot send a Supabase JWT).
//   2. Read the RAW body first and verify the signature against it. Any
//      reserialization breaks verification.
//   3. Signature check is manual (Web Crypto HMAC-SHA256) - no SDK, so no
//      Deno-compat surprises. Scheme per Stripe docs: signed_payload is
//      "<t>.<raw body>", key is the whsec_ secret, compare hex constant-time,
//      accept only v1 schemes (downgrade protection), honour a 5-minute
//      tolerance, and accept ANY of the v1 signatures (secret rotation sends
//      one per active secret).
//   4. Dedupe on event id via payment_events - Stripe retries, and may send
//      the same event twice. Insert-first; a unique violation means "seen".
//   5. Money is never lost: if a payment arrives for an invoice that is
//      somehow already paid, the payment row is STILL recorded (it shows as
//      an overpayment Race can refund) rather than silently dropped.
//   6. Return 2xx fast; failures are logged, not retried into a loop.
//
// Subscribe this endpoint to: checkout.session.completed,
// checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
// charge.refunded
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOLERANCE_SECONDS = 300; // Stripe's own default; never 0

const enc = new TextEncoder();

function hexEqual(a: string, b: string): boolean {
  // Constant-time-ish comparison: same length check plus full-length XOR scan.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify per https://docs.stripe.com/webhooks#verify-manually */
async function verifyStripeSignature(raw: string, header: string, secret: string): Promise<boolean> {
  let timestamp = "";
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim(), v = part.slice(idx + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") v1.push(v);   // ignore v0 and anything else
  }
  if (!timestamp || !v1.length) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > TOLERANCE_SECONDS) return false;

  const expected = await hmacHex(secret, `${timestamp}.${raw}`);
  return v1.some((sig) => hexEqual(sig, expected));
}

/** Fire the receipt email server-to-server. Never throws into the payment
 *  path: the money is already recorded, and a mail failure must not turn a
 *  successful payment into a retried webhook.
 *
 *  `notify_owner` BCCs the owner so a payment that lands while nobody is at
 *  the desk still reaches a human - previously an online payment by a walk-in
 *  notified nobody at all. */
/** Everything a paid sale should have made real: the membership becomes
 *  active, the roster place becomes active, the private lesson becomes a real
 *  booking and reaches the wall calendar.
 *
 *  This used to live ONLY inside each checkout's finalize branch, and only ran
 *  when finalize was the one that flipped the sale to paid. This webhook races
 *  the browser and can win, in which case finalize skipped the whole block. On
 *  2026-08-20 that left a paid private lesson pending, and the hold-expiry
 *  sweep then canceled a lesson somebody had already paid for.
 *
 *  So it runs whenever a sale is paid, not once at the moment it flips, and
 *  every step is idempotent. */
async function reconcilePaidSale(
  admin: { from: (t: string) => any },
  saleId: string,
): Promise<void> {
  try {
    // Online enrollments are written pending so an abandoned checkout leaves
    // no active member behind. Paid means active.
    await admin.from("memberships").update({ status: "active" })
      .eq("sale_id", saleId).eq("status", "pending");
    await admin.from("enrollments").update({ status: "active" })
      .eq("sale_id", saleId).eq("status", "pending");

    // ...and the PERSON. Web checkouts create the contact as a lead so an
    // abandoned form never lands a stranger on the active roll; paying is
    // what makes somebody a student. Scoped to lead so this can never
    // reopen a former member or overwrite a trial.
    const buyer = await admin.from("pos_sales").select("buyer_contact_id")
      .eq("id", saleId).maybeSingle();
    if (buyer.data?.buyer_contact_id) {
      await admin.from("contacts").update({ segment: "active" })
        .eq("id", buyer.data.buyer_contact_id).eq("segment", "lead");
    }

    // Testing registrations: the census paid flag follows the money. It
    // used to flip only in the browser finalize, so when this backstop won
    // the race the sale read paid while the census read unpaid (7 of 13
    // paid signups the week of 2026-08-24). Zero rows for non-testing sales.
    await admin.from("testing_signups").update({ paid: true })
      .eq("sale_id", saleId).eq("paid", false);

    // A lesson hold becomes a real booking, even if the expiry sweep already
    // canceled it: the money says otherwise.
    const lessons = await admin.from("private_lessons")
      .update({ status: "booked", notes: null })
      .eq("sale_id", saleId).in("status", ["pending", "canceled"])
      .select("starts_at,student_name");
    for (const row of (lessons.data ?? []) as Record<string, unknown>[]) {
      const at = new Date(String(row.starts_at));
      const ymd = at.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
      const hm = at.toLocaleTimeString("en-US", {
        timeZone: "America/Chicago", hour: "numeric", minute: "2-digit", hour12: true,
      });
      const already = await admin.from("calendar_events").select("id")
        .eq("type", "private").eq("event_date", ymd).eq("event_time", hm).limit(1);
      if (!already.data || !already.data.length) {
        await admin.from("calendar_events").insert({
          type: "private",
          title: "Private · " + (row.student_name || "Private lesson"),
          event_date: ymd, event_time: hm,
          created_by: "private-checkout@website",
        });
      }
    }
  } catch (e) {
    console.error("reconcile failed for", saleId, e);
  }
}

async function sendReceipt(saleId: string): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const res = await fetch(`${url}/functions/v1/send-receipt`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        "Origin": "https://crm.barestkd.fit",
      },
      // No `to`: send-receipt resolves the recipient itself - the address the
      // payer used at checkout, else the buyer on file.
      body: JSON.stringify({ sale_id: saleId, notify_owner: true }),
    });
    if (!res.ok) console.error("receipt send failed", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("receipt send threw", e);
  }
}

function methodFromSession(session: Record<string, any>): string {
  const types: string[] = session?.payment_method_types ?? [];
  if (types.includes("us_bank_account")) return "ach";
  return "card";
}

/** Where a card payment actually came from, for the ledger note.
 *
 * This branch used to hardcode "keyed at the desk". It is the BACKSTOP for
 * every card payment, not just POS ones, so on 2026-08-19 it labelled a
 * payment Mike made through his invoice link as taken at the front desk,
 * and won the race against create-checkout which had it right. Every
 * PaymentIntent we create carries metadata.source; read it instead of
 * guessing, and stay vague rather than wrong when it is missing. */
/* Brand and last four of the card that paid, wherever Stripe put them on
 * this object. A charge carries payment_method_details.card; an expanded
 * payment intent carries latest_charge; a checkout session carries
 * payment_intent. Missing is normal - ACH and cash have no card - and
 * returns nulls rather than guessing. */
function cardBits(obj: Record<string, unknown>): { card_brand: string | null; card_last4: string | null } {
  const seen = new Set<unknown>();
  const walk = (o: unknown, depth: number): Record<string, unknown> | null => {
    if (!o || typeof o !== "object" || depth > 4 || seen.has(o)) return null;
    seen.add(o);
    const rec = o as Record<string, unknown>;
    if (typeof rec.last4 === "string" && typeof rec.brand === "string") return rec;
    for (const v of Object.values(rec)) { const hit = walk(v, depth + 1); if (hit) return hit; }
    return null;
  };
  const c = walk(obj, 0);
  return {
    card_brand: c && typeof c.brand === "string" ? String(c.brand).slice(0, 32) : null,
    card_last4: c && /^[0-9]{4}$/.test(String(c.last4)) ? String(c.last4) : null,
  };
}

function paymentNote(source: string): string {
  switch (source) {
    case "pos-manual":        return "Card payment (keyed at the desk)";
    case "invoice-page":      return "Card payment (invoice page)";
    case "lk-checkout":       return "Card payment (Little Kickers signup)";
    case "cubs-checkout":     return "Card payment (Cubs enrollment)";
    case "testing-checkout":  return "Card payment (testing registration)";
    case "program-checkout":  return "Card payment (online enrollment)";
    case "private-checkout":  return "Card payment (private lesson)";
    default:                  return "Card payment";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("not configured", { status: 500 });
  }

  // RAW body first - this exact string is what was signed.
  const raw = await req.text();
  const sigHeader = req.headers.get("Stripe-Signature") ?? "";
  if (!(await verifyStripeSignature(raw, sigHeader, secret))) {
    console.error("signature verification failed");
    return new Response("bad signature", { status: 400 });
  }

  let event: Record<string, any>;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Dedupe: insert-first. A unique violation means we already have it.
  const seen = await admin.from("payment_events").insert({
    stripe_event_id: event.id, type: event.type, payload: event,
  });
  if (seen.error) {
    if (String(seen.error.code) === "23505") return new Response("duplicate ignored", { status: 200 });
    console.error("payment_events insert failed", seen.error);
    // Fall through: recording the money matters more than the audit row.
  }

  try {
    const obj = event.data?.object ?? {};

    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      // For card, completed already means paid. For ACH, completed fires while
      // still pending and async_payment_succeeded fires when it clears.
      if (obj.payment_status !== "paid") {
        await admin.from("payment_events").update({ handled_at: new Date().toISOString(), handle_error: "not yet paid (" + obj.payment_status + ")" }).eq("stripe_event_id", event.id);
        return new Response("ok", { status: 200 });
      }
      const saleId = obj.client_reference_id || obj.metadata?.sale_id;
      if (!saleId) throw new Error("no sale id on session " + obj.id);

      const amount = Number(obj.amount_total ?? 0);
      if (amount <= 0) throw new Error("no amount on session " + obj.id);

      const method = methodFromSession(obj);
      const pi = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id ?? null;

      // The address the payer typed at checkout. For a walk-in sale this is
      // the ONLY email anybody has, so without it the receipt goes nowhere.
      // Stored as-is and never written onto a contact here: an email entered
      // at a checkout page is not proof of identity, and silently changing a
      // member's address would redirect all their future receipts. The CRM
      // asks staff before adopting it.
      const payerEmail = String(obj.customer_details?.email ?? obj.customer_email ?? "").trim().toLowerCase();
      if (payerEmail && payerEmail.length <= 200) {
        // payer_email is the ONE typed-at-checkout column (2026-08-25);
        // null-guarded so a checkout that already stamped it wins.
        const se = await admin.from("pos_sales").update({ payer_email: payerEmail }).eq("id", saleId).is("payer_email", null);
        if (se.error) console.error("payer_email stamp failed", se.error); // not fatal to the payment
      }

      // Idempotency at the money level too: one payment row per session.
      const existing = await admin.from("pos_payments")
        .select("id").eq("sale_id", saleId).eq("stripe_object_id", obj.id).maybeSingle();
      if (!existing.data) {
        const ins = await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "charge", amount_cents: amount, method,
          stripe_object_id: obj.id, stripe_event_id: event.id,
          ...cardBits(obj),
          note: method === "ach" ? "Bank payment (Stripe)" : "Card payment (Stripe)",
        });
        if (ins.error) throw ins.error;
      }

      // Mark paid only when the ledger says the balance is actually covered.
      const sale = await admin.from("pos_sales").select("total_cents,status").eq("id", saleId).single();
      if (!sale.error && sale.data) {
        const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
        const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
        if (net >= sale.data.total_cents && sale.data.status !== "paid") {
          const upd = await admin.from("pos_sales").update({
            status: "paid", tender_method: method,
            confirmed_at: new Date().toISOString(), stripe_payment_intent: pi,
          }).eq("id", saleId);
          if (upd.error) console.error("mark paid failed", upd.error);
          else { await reconcilePaidSale(admin, saleId); await sendReceipt(saleId); }
        } else if (sale.data.status === "paid") {
          // The browser got there first. Reconcile anyway: whoever loses this
          // race must not leave a paid membership or lesson unfinished.
          await reconcilePaidSale(admin, saleId);
        }
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      // ACH bounced. Leave the invoice unpaid and leave a trail.
      const saleId = obj.client_reference_id || obj.metadata?.sale_id;
      if (saleId) {
        await admin.from("pos_payments").insert({
          sale_id: saleId, kind: "ach_return", amount_cents: 0,
          method: "ach", stripe_object_id: obj.id, stripe_event_id: event.id,
          note: "Bank payment failed - invoice still owes its balance",
        });
      }
    } else if (event.type === "payment_intent.succeeded") {
      // A card keyed at the front desk (pos-charge). The CRM already calls
      // pos-charge's finalize, which writes the same row synchronously so the
      // desk gets an instant answer; this is the backstop for a browser that
      // closed mid-confirm. Both dedupe on stripe_object_id, so whichever
      // arrives second does nothing.
      const saleId = obj.metadata?.sale_id;
      const amount = Number(obj.amount_received ?? 0);
      if (saleId && amount > 0) {
        const seen = await admin.from("pos_payments")
          .select("id").eq("sale_id", saleId).eq("stripe_object_id", obj.id).maybeSingle();
        if (!seen.data) {
          await admin.from("pos_payments").insert({
            sale_id: saleId, kind: "charge", amount_cents: amount,
            method: "card", stripe_object_id: obj.id, stripe_event_id: event.id,
            ...cardBits(obj),
            note: paymentNote(String(obj.metadata?.source ?? "")),
          });
        }
        const sale = await admin.from("pos_sales").select("total_cents,status").eq("id", saleId).single();
        if (!sale.error && sale.data && sale.data.status !== "paid") {
          const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
          const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
          if (net >= sale.data.total_cents) {
            const upd = await admin.from("pos_sales").update({
              status: "paid", tender_method: "card",
              confirmed_at: new Date().toISOString(), stripe_payment_intent: obj.id,
            }).eq("id", saleId);
            if (!upd.error) { await reconcilePaidSale(admin, saleId); await sendReceipt(saleId); }
          }
        }
      }
    } else if (event.type === "payment_method.attached") {
      // A card was saved, however it arrived: the public update-card page,
      // the field at the desk, a checkout that kept the card, or somebody
      // typing it into Stripe. The browser is what confirms a SetupIntent, so
      // this is the only moment the SERVER can be sure it happened.
      const cust = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      const brand = String(obj.card?.brand ?? "card");
      const last4 = String(obj.card?.last4 ?? "????");

      // ── the same card, typed again, is not a second card ────────────────
      // The public checkouts have no login, so they cannot safely OFFER a
      // saved card - anyone knowing a family's email could charge it. So a
      // returning parent re-types their card every time and Stripe attaches
      // another payment method, and a family ends up with five copies of one
      // card (Race, 2026-08-26: "i dont want a million repeat cards on file").
      //
      // Stripe's fingerprint is stable for a card number across entries, so
      // the duplicate is detectable without ever seeing the number. Keep the
      // one that just arrived - its expiry is freshest - and detach the older
      // twins. If one of them was the customer's default, the new one takes
      // that role first, so a family is never left with no default.
      //
      // Best effort throughout: a failure here must never disturb the payment
      // that triggered it.
      const fp = String(obj.card?.fingerprint ?? "");
      const skDedupe = Deno.env.get("STRIPE_SECRET_KEY");
      if (cust && fp && skDedupe && obj.id) {
        try {
          const auth = { Authorization: "Bearer " + skDedupe };
          const listRes = await fetch(
            "https://api.stripe.com/v1/payment_methods?limit=100&type=card&customer=" + encodeURIComponent(cust),
            { headers: auth });
          if (listRes.ok) {
            const all = (await listRes.json()).data ?? [];
            const twins = all.filter((m: Record<string, any>) =>
              m.id !== obj.id && String(m.card?.fingerprint ?? "") === fp);
            if (twins.length) {
              // Owner's call, 2026-08-26: keep the card ALREADY on file and
              // drop the one just typed. The survivor is what memberships are
              // billed to, so nothing downstream ever has to be rewired -
              // "less to fuck up".
              //
              // The cost of keeping the older row is its older EXPIRY: a
              // reissued card keeps its number, so it has the same fingerprint
              // but a later expiry, and the stale one would decline months
              // from now. So copy the fresh expiry onto the survivor before
              // dropping the new one. Stripe allows updating expiry on a
              // payment method; the number itself is never touched.
              const keep = twins.sort((a: Record<string, any>, b: Record<string, any>) =>
                (a.created ?? 0) - (b.created ?? 0))[0];
              const em = obj.card?.exp_month, ey = obj.card?.exp_year;
              if (em && ey && (keep.card?.exp_month !== em || keep.card?.exp_year !== ey)) {
                await fetch("https://api.stripe.com/v1/payment_methods/" + encodeURIComponent(String(keep.id)), {
                  method: "POST",
                  headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
                  body: "card[exp_month]=" + encodeURIComponent(String(em))
                      + "&card[exp_year]=" + encodeURIComponent(String(ey)),
                }).catch((e) => console.error("expiry refresh failed", e));
              }
              // Everything that is not the survivor goes, including the card
              // that just arrived.
              const drop = all.filter((m: Record<string, any>) =>
                String(m.card?.fingerprint ?? "") === fp && m.id !== keep.id);
              const cRes2 = await fetch("https://api.stripe.com/v1/customers/" + encodeURIComponent(cust),
                { headers: auth });
              const defNow = cRes2.ok
                ? String((await cRes2.json()).invoice_settings?.default_payment_method ?? "") : "";
              if (defNow && drop.some((m: Record<string, any>) => m.id === defNow)) {
                await fetch("https://api.stripe.com/v1/customers/" + encodeURIComponent(cust), {
                  method: "POST",
                  headers: { ...auth, "Content-Type": "application/x-www-form-urlencoded" },
                  body: "invoice_settings[default_payment_method]=" + encodeURIComponent(String(keep.id)),
                });
              }
              for (const m of drop) {
                // Defensive: the CRM should never be pointing at a card that
                // arrived seconds ago, but repoint before detaching anyway.
                for (const [tbl, col] of [
                  ["households", "default_payment_method"],
                  ["memberships", "payment_method_id"],
                  ["membership_installments", "payment_method_id"],
                ] as [string, string][]) {
                  const r = await admin.from(tbl).update({ [col]: keep.id }).eq(col, String(m.id));
                  if (r.error) console.error("dedupe repoint failed", tbl, r.error);
                }
                await fetch("https://api.stripe.com/v1/payment_methods/"
                  + encodeURIComponent(String(m.id)) + "/detach", { method: "POST", headers: auth });
              }
              console.log("[dedupe] kept " + keep.id + ", detached " + drop.length + " for " + cust);
            }
          }
        } catch (e) {
          console.error("card dedupe failed (payment unaffected)", e);
        }
      }
      const exp = String(obj.card?.exp_month ?? "?").padStart(2, "0")
        + "/" + String(obj.card?.exp_year ?? "????").slice(-2);

      // Whose it is. A Stripe customer belongs to a guardian now, and only
      // falls back to a contact for the older rows that were filed that way.
      let whose = "somebody not on file";
      let where = "";
      let flagged = false;
      if (cust) {
        const g = await admin.from("guardians")
          .select("id,name").eq("stripe_customer_id", cust).maybeSingle();
        if (g.data) {
          whose = String(g.data.name || "an unnamed guardian");
          const kids = await admin.from("student_guardians")
            .select("contacts:student_id(first_name,last_name)").eq("guardian_id", g.data.id);
          const names = (kids.data ?? [])
            .map((r: Record<string, any>) => r.contacts
              ? [r.contacts.first_name, r.contacts.last_name].filter(Boolean).join(" ") : "")
            .filter(Boolean);
          if (names.length) where = "Guardian of " + names.join(", ");
        } else {
          const c = await admin.from("contacts")
            .select("id,first_name,last_name").eq("stripe_customer_id", cust).maybeSingle();
          if (c.data) {
            whose = [c.data.first_name, c.data.last_name].filter(Boolean).join(" ");
            // A card on a PARTICIPANT rather than a guardian is the fallback
            // the update-card page uses when an address matches nobody. It
            // wants moving, so say so rather than leaving it to be noticed.
            where = "On the participant's own record - may need moving to a guardian";
            flagged = true;
          }
        }
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      // The same address his paid-notifications already use, so card alerts
      // and payment alerts land in one place rather than two.
      const ownerAddr = (Deno.env.get("OWNER_NOTIFY_EMAIL") || "race@barestkd.fit").trim().toLowerCase();
      if (resendKey) {
        const esc = (x: string) => String(x ?? "")
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:460px;'
          + 'margin:0 auto;padding:18px 14px">'
          + '<p style="font-size:12px;letter-spacing:.08em;color:#777;margin:0 0 4px">CARD SAVED</p>'
          + '<p style="font-size:22px;font-weight:bold;margin:0 0 14px;text-transform:capitalize">'
          + esc(brand) + ' &bull;&bull;&bull;&bull; ' + esc(last4) + '</p>'
          + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6">'
          + '<tr><td style="color:#777;padding-right:12px;vertical-align:top">Whose</td><td>' + esc(whose) + '</td></tr>'
          + (where ? '<tr><td style="color:#777;padding-right:12px;vertical-align:top">Where</td><td'
              + (flagged ? ' style="color:#EA0000;font-weight:bold"' : '') + '>' + esc(where) + '</td></tr>' : '')
          + '<tr><td style="color:#777;padding-right:12px;vertical-align:top">Expires</td><td>' + esc(exp) + '</td></tr>'
          + '</table>'
          + '<p style="margin:16px 0 0;font-size:12.5px;color:#777">Nothing was charged. '
          + 'This is a card being kept on file.</p></div>';
        // Best effort: a notification that fails must never fail the webhook,
        // or Stripe retries an event that was handled perfectly well.
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Bares Taekwondo <receipts@barestkd.fit>",
            to: [ownerAddr],
            subject: "Card saved: " + brand + " ••••" + last4 + " · " + whose,
            html,
          }),
        }).then((r) => { if (!r.ok) console.error("card notify failed", r.status); })
          .catch((e) => console.error("card notify threw", e));
      }
    } else if (event.type === "payout.created" || event.type === "payout.paid" || event.type === "payout.failed") {
      // Owner: "an email for expected payouts... when they plan to send a
      // batch of money and how much, and I could use the two [this and the
      // EOD report] to reference each other." payout.created is the plan,
      // payout.paid is the send, payout.failed is the bank bouncing it.
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const ownerAddr = (Deno.env.get("OWNER_NOTIFY_EMAIL") || "race@barestkd.fit").trim().toLowerCase();
      if (resendKey) {
        const dollars = (c: number) => "$" + (Number(c || 0) / 100).toFixed(2);
        const day = (unix: number) => unix
          ? new Date(unix * 1000).toLocaleDateString("en-US",
              { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" })
          : "?";
        const amount = dollars(obj.amount);
        const arrives = day(obj.arrival_date);

        // What the payout CONTAINS, so it can be held against the nightly
        // report. Best effort: if this lookup fails, the email still goes,
        // just without the breakdown.
        let breakdown = "";
        const sk = Deno.env.get("STRIPE_SECRET_KEY");
        if (sk && event.type !== "payout.failed") {
          try {
            const r = await fetch(
              "https://api.stripe.com/v1/balance_transactions?limit=100&payout=" + obj.id,
              { headers: { Authorization: "Bearer " + sk } });
            if (r.ok) {
              const txs = (await r.json()).data ?? [];
              const charges = txs.filter((t: Record<string, any>) => t.type === "charge" || t.type === "payment");
              const gross = charges.reduce((a: number, t: Record<string, any>) => a + (t.amount || 0), 0);
              const fees = charges.reduce((a: number, t: Record<string, any>) => a + (t.fee || 0), 0);
              const rows = charges.slice(0, 20).map((t: Record<string, any>) =>
                '<tr><td style="color:#777;padding-right:12px">' + day(t.created) + "</td>"
                + '<td style="text-align:right">' + dollars(t.amount) + "</td></tr>").join("");
              breakdown =
                '<p style="font-size:12px;letter-spacing:.08em;color:#777;margin:18px 0 4px">COVERS</p>'
                + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6">'
                + rows
                + (charges.length > 20 ? '<tr><td colspan="2" style="color:#777">+ ' + (charges.length - 20) + " more</td></tr>" : "")
                + '<tr><td style="color:#777;padding-right:12px;border-top:1px solid #ddd">' + charges.length + " charge" + (charges.length === 1 ? "" : "s") + " gross</td>"
                + '<td style="text-align:right;border-top:1px solid #ddd">' + dollars(gross) + "</td></tr>"
                + '<tr><td style="color:#777;padding-right:12px">Stripe fees</td>'
                + '<td style="text-align:right">-' + dollars(fees) + "</td></tr>"
                + "</table>"
                + '<p style="margin:14px 0 0;font-size:12.5px;color:#777">Hold the COVERS list against those days\' nightly reports. '
                + "Cash and checks never ride in a Stripe payout, so only the card portion should match.</p>";
            }
          } catch (e) { console.error("payout breakdown failed", e); }
        }

        const failed = event.type === "payout.failed";
        const head = failed ? "PAYOUT FAILED" : event.type === "payout.paid" ? "PAYOUT SENT" : "PAYOUT SCHEDULED";
        const line = failed
          ? "The bank returned it: " + String(obj.failure_message || obj.failure_code || "no reason given")
          : (event.type === "payout.paid" ? "Sent to the bank, should land " : "Expected to arrive ") + arrives;
        const html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:460px;margin:0 auto;padding:18px 14px">'
          + '<p style="font-size:12px;letter-spacing:.08em;color:#777;margin:0 0 4px">' + head + "</p>"
          + '<p style="font-size:26px;font-weight:bold;margin:0 0 8px' + (failed ? ';color:#EA0000' : '') + '">' + amount + "</p>"
          + '<p style="font-size:14px;margin:0">' + line + "</p>"
          + breakdown + "</div>";
        // Best effort, same rule as the card email: a notification that
        // fails must never fail the webhook, or Stripe retries an event
        // that was handled perfectly well.
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Bares Taekwondo <receipts@barestkd.fit>",
            to: [ownerAddr],
            subject: failed ? "STRIPE PAYOUT FAILED: " + amount
              : (event.type === "payout.paid" ? "Stripe payout sent: " : "Stripe payout scheduled: ")
                + amount + " \u00b7 " + arrives,
            html,
          }),
        }).then((r) => { if (!r.ok) console.error("payout notify failed", r.status); })
          .catch((e) => console.error("payout notify threw", e));
      }
    } else if (event.type === "charge.refunded") {
      // Record refunds issued from the Stripe dashboard so the CRM ledger and
      // Stripe never disagree. Amount is the NEWLY refunded portion.
      const saleId = obj.metadata?.sale_id;
      const refunded = Number(obj.amount_refunded ?? 0);
      if (saleId && refunded > 0) {
        const prior = await admin.from("pos_payments")
          .select("amount_cents").eq("sale_id", saleId).eq("kind", "refund");
        const already = -(prior.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
        const delta = refunded - already;
        if (delta > 0) {
          await admin.from("pos_payments").insert({
            sale_id: saleId, kind: "refund", amount_cents: -delta, method: "card",
            stripe_object_id: obj.id, stripe_event_id: event.id,
            note: "Refunded in Stripe",
          });
        }
        // A refund that leaves a balance reopens the invoice: the money is owed
        // again until the owner collects it another way or closes the invoice
        // (owner rule 2026-08-21). The receipt claim resets so the next payment
        // gets its own receipt. Refunding an overpayment leaves it paid.
        const sale = await admin.from("pos_sales").select("status,total_cents").eq("id", saleId).single();
        if (!sale.error && sale.data && sale.data.status === "paid") {
          const pays = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
          const net = (pays.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
          if (net < sale.data.total_cents) {
            await admin.from("pos_sales").update({ status: "unpaid", receipt_sent_at: null })
              .eq("id", saleId).eq("status", "paid");
          }
        }
      }
    }

    await admin.from("payment_events").update({ handled_at: new Date().toISOString() }).eq("stripe_event_id", event.id);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("handler error", event.type, e);
    await admin.from("payment_events")
      .update({ handle_error: String((e as Error)?.message ?? e) })
      .eq("stripe_event_id", event.id);
    // 200 on purpose: the event is stored, and a retry storm helps nobody.
    // payment_events.handle_error is the queue of things to look at.
    return new Response("recorded with error", { status: 200 });
  }
});
