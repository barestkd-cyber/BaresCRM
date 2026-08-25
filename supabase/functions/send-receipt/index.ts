// ===========================================================================
// Supabase Edge Function: send-receipt
// ---------------------------------------------------------------------------
// Emails a SHORT branded receipt/invoice notification with a "View receipt"
// button linking to the live view-only page (receipt-view, addressed by the
// sale's view_token). The email deliberately carries only the total and
// paid/due state - the link is the receipt.
//
// HARD RULES:
//   1. STAFF OR INTERNAL. Deployed WITH --no-verify-jwt (see the DEPLOY
//      note further down for why), so this function does its OWN auth: it
//      accepts either the exact injected service key, used by our other
//      functions server-to-server, or a signed-in user who passes
//      is_staff() on their own token. Nothing else gets in.
//   2. The client sends ONLY { sale_id, to: [emails] } - the ledger row is
//      the source of everything rendered. Max 10 recipients - a bound on
//      how far one family's invoice can travel if the list is ever wrong,
//      not a mail limit. It REFUSES rather than truncating, so a dropped
//      parent can never look like a successful send.
//   3. Brand identity follows the sale's brand; the legal line names the LLC.
//   4. Send via Resend (project secret RESEND_API_KEY); from-address stays on
//      the verified domain barestkd.fit.
//   5. On success, stamp receipt_email (first recipient) + receipt_sent_at.
//
// Deploy, from the BaresCRM repo root (one-time link first):
//   supabase link --project-ref akdncbzxiwvihfcyijvm
//   supabase functions deploy send-receipt
//   supabase functions deploy receipt-view --no-verify-jwt
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { LOGO_PNG_BASE64 } from "./logo.ts";
// The recipient rulebook. Pure, no I/O, and the SAME FILE the Node suite
// (tests/receipt-rules.test.js) imports - the 2026-08-24 silence happened
// in logic no test could reach, and this is what makes it reachable.
import { resolveRecipients } from "../_shared/recipients.mjs";

const ALLOWED_ORIGINS = ["https://crm.barestkd.fit"];

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** The signed agreement as a PDF, for the email trail. Same recipe the trial
 *  funnel's waiver uses: wrap + paginate the stored body_text, then embed the
 *  drawn signature. The DOCUMENT OF RECORD stays the database row; this is a
 *  faithful print of it. */
async function agreementPdf(bodyText: string, signaturePng: string | null): Promise<string> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pageW = 612, pageH = 792, margin = 54, maxW = pageW - margin * 2;
  const size = 9.5, lh = size * 1.45;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;
  // The school's mark at the top of page one, same as the trial waiver PDF.
  try {
    const logoRaw = Uint8Array.from(atob(LOGO_PNG_BASE64), (ch) => ch.charCodeAt(0));
    const logo = await pdf.embedPng(logoRaw);
    const lw = 140, lh = logo.height * (lw / logo.width);
    page.drawImage(logo, { x: (pageW - lw) / 2, y: y - lh, width: lw, height: lh });
    y -= lh + 14;
  } catch (e) {
    console.error("pdf logo failed", e);
  }
  const down = (need: number) => {
    if (y - need < margin) { page = pdf.addPage([pageW, pageH]); y = pageH - margin; }
  };
  for (const para of String(bodyText).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { down(lh); y -= lh * 0.6; continue; }
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        down(lh); page.drawText(line, { x: margin, y, size, font }); y -= lh;
        line = w;
      } else line = test;
    }
    if (line) { down(lh); page.drawText(line, { x: margin, y, size, font }); y -= lh; }
  }
  if (signaturePng && signaturePng.startsWith("data:image/png;base64,")) {
    try {
      const png = await pdf.embedPng(signaturePng);
      const w = Math.min(220, png.width), h = png.height * (w / png.width);
      down(h + lh * 2);
      y -= lh;
      page.drawText("Signature:", { x: margin, y, size, font });
      y -= h + 4;
      page.drawImage(png, { x: margin, y, width: w, height: h });
      y -= lh;
    } catch (e) {
      console.error("signature embed failed", e);
    }
  }
  return b64(await pdf.save());
}
// DEPLOY: supabase functions deploy send-receipt --no-verify-jwt
//
// The --no-verify-jwt is REQUIRED and was learned the hard way on
// 2026-08-19. Supabase rotated the injected env keys on 2026-08-18, and
// SUPABASE_SERVICE_ROLE_KEY is now a 41-char sb_secret_ key rather than a
// legacy JWT. Our own functions call this one server-to-server with that
// key as a bearer token; the API gateway tried to parse it as
// a JWT, failed, and returned 401 BEFORE the request ever reached this
// function. Every web-checkout receipt was silently failing, because the
// callers log the failure and swallow it so a receipt problem can never
// cost a payment.
//
// Skipping gateway verification does NOT weaken this endpoint: the auth
// gate below is the real one, and it still demands either the exact
// service key or a signed-in staff user.
const REPLY_TO = "race@barestkd.fit";
const LEGAL_ENTITY = "Grizzly Martial Arts & Fitness LLC";

// Brand catalog - keep aligned with RECEIPT_BRANDS in BaresCRM/index.html.
const BRANDS: Record<string, { name: string; dba: boolean; logo: string | null }> = {
  btkd: { name: "Bares Taekwondo Fitness", dba: true, logo: "https://barestkd.fit/assets/img/logo.png" },
  gbs: { name: "Grizzly Business Systems", dba: true, logo: "https://crm.barestkd.fit/gbs-logo.png" },
  gmaf: { name: LEGAL_ENTITY, dba: false, logo: null },
};

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const esc = (v: unknown) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

const fmtDate = (ymd: unknown) => {
  const p = String(ymd ?? "").slice(0, 10).split("-");
  return p.length === 3 ? p[1] + "-" + p[2] + "-" + p[0] : String(ymd ?? "");
};

const money = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "RESEND_API_KEY not configured" }, 500, cors);

    // ── caller must be staff, OR an internal server-to-server call ─────────
    // The Stripe webhook and other server code have no staff JWT, so they
    // authenticate with the service-role key instead. That key never leaves
    // Supabase, so possessing it IS the authorization.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const internal = !!bearer && bearer === serviceKey;
    if (!internal) {
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: userData, error: userErr } = await caller.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Not signed in" }, 401, cors);
      const { data: staffOk, error: staffErr } = await caller.rpc("is_staff");
      if (staffErr || staffOk !== true) return json({ error: "Staff only" }, 403, cors);
    }

    // ── input: sale id + recipient list, nothing else trusted ──────────────
    const body = await req.json().catch(() => ({}));
    const saleId = String(body.sale_id ?? "").trim();
    const toRaw: unknown[] = Array.isArray(body.to) ? body.to : [body.to];
    const to = [...new Set(toRaw.map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean))];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId)) {
      return json({ error: "Bad sale_id" }, 400, cors);
    }
    if (to.length > 10 || to.some((t) => !EMAIL_RE.test(t) || t.length > 200)) {
      return json({ error: "Bad recipient list (max 10 valid emails)" }, 400, cors);
    }
    // Empty list = "send it to whoever this invoice belongs to". Automatic
    // sends after a payment use this; the CRM button passes explicit emails.

    // ── load the sale; make sure it has a view token ────────────────────────
    const admin = createClient(url, serviceKey);
    const saleRes = await admin.from("pos_sales")
      .select("id,status,brand,total_cents,sale_date,view_token,buyer_contact_id,stripe_email,receipt_email,customer_note,calendar_url,notes,receipt_sent_at,staff_email,payer_name,payer_email")
      .eq("id", saleId).single();
    if (saleRes.error || !saleRes.data) return json({ error: "Sale not found" }, 404, cors);
    const s = saleRes.data;

    // ── one receipt per payment, however many things noticed it ──────────
    // Two independent paths can see the same payment land: the page the
    // customer paid on (create-checkout, or a checkout function finalizing),
    // and the Stripe webhook backstop that exists for the customer who closes
    // the tab mid-payment. Both are correct to fire, and on 2026-08-19 both
    // did, so Mike got two identical receipts and Race got two notifications
    // one second apart.
    //
    // The payment ledger deduped properly on stripe_object_id, so the money
    // was only ever recorded once; it was only the mail that doubled.
    //
    // AUTOMATIC sends authenticate with the service key; Race clicking Email
    // in the CRM authenticates with his own staff token. So `internal` is
    // exactly the line between "something noticed a payment" and "a human
    // asked for this", and only the former is suppressed. Re-sending a
    // receipt by hand must always work, including to a corrected address.
    if (!to.length) {
      // One rulebook, shared byte-for-byte with the Node test suite
      // (_shared/recipients.mjs): typed wins outright, always-copy rides,
      // the on-file list stands in for desk sales, and the skip reasons
      // feed the alarm below. The owner rulings live in ECOSYSTEM 16.6h.
      let sendList: { email: string; why?: string }[] = [];
      if (s.buyer_contact_id) {
        const list = await admin.rpc("contact_send_list", { p_contact: s.buyer_contact_id });
        if (list.error) console.error("send list", list.error);
        sendList = (list.data ?? []) as { email: string; why?: string }[];
      }
      const resolved = resolveRecipients({
        payerEmail: String((s as Record<string, unknown>).payer_email ?? ""),
        sendList, hasBuyer: !!s.buyer_contact_id,
      });
      for (const a of resolved.to) to.push(a);
      if (!to.length) {
        // A PAID sale that nobody can be emailed about is an alarm, not a
        // quiet skip (owner, 2026-08-25). On 2026-08-24 three families paid
        // 309.88 and this branch swallowed it; the owner found out from
        // the nightly report and had to dig. Money with no receipt now
        // emails him the same minute. An UNPAID sale still skips quietly:
        // a walk-in invoice with no address is normal, not an emergency.
        if (s.status === "paid") {
          const ownerAddr = (Deno.env.get("OWNER_NOTIFY_EMAIL") || "race@barestkd.fit").trim().toLowerCase();
          const why = s.buyer_contact_id
            ? "The buyer is on file but has no emailable address anywhere."
            : "Walk-in sale with no checkout email on it.";
          // Best effort: the alarm must never break the payment path.
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Bares Taekwondo <receipts@barestkd.fit>",
              to: [ownerAddr],
              subject: "PAID BUT NOBODY EMAILED: " + money(Number(s.total_cents)),
              html: '<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:460px;margin:0 auto;padding:18px 14px">'
                + '<p style="font-size:12px;letter-spacing:.08em;color:#c8102e;margin:0 0 4px">PAID, NO RECEIPT SENT</p>'
                + '<p style="font-size:24px;font-weight:bold;margin:0 0 10px">' + money(Number(s.total_cents)) + "</p>"
                + '<p style="font-size:14px;margin:0 0 6px">A payment landed on ' + String(s.sale_date ?? "today")
                + " and the receipt sender found nobody to email. " + why + "</p>"
                + (s.view_token ? '<p style="font-size:14px;margin:0"><a href="https://www.barestkd.fit/invoice/?t='
                    + String(s.view_token) + '">Open the invoice</a></p>' : "")
                + "</div>",
            }),
          }).then((r) => { if (!r.ok) console.error("skip alarm failed", r.status); })
            .catch((e) => console.error("skip alarm threw", e));
        }
        return json({ ok: false, skipped: s.buyer_contact_id
          ? "nobody on file to email" : "walk-in sale with no checkout email, nobody to email" }, 200, cors);
      }
    }

    // CLAIM the send, do not merely check for it. Two callers land here 15
    // milliseconds apart in the real world (2026-08-20: the webhook and
    // lk-checkout both saw Lacy Musslewhite’s payment, and a read-then-write
    // guard let both through, so she got two receipts and emailed asking if
    // she had paid twice). A conditional UPDATE is atomic: exactly one caller
    // can flip receipt_sent_at from null, and that one owns the send.
    //
    // Only automatic sends claim. Race clicking Email in the CRM must always
    // send, including a second copy to a corrected address.
    if (internal) {
      const claim = await admin.from("pos_sales")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", saleId).is("receipt_sent_at", null)
        .select("id");
      if (claim.error) {
        console.error("receipt claim failed", claim.error);
        return json({ error: "could not claim the send" }, 500, cors);
      }
      if (!claim.data || !claim.data.length) {
        return json({ ok: true, skipped: "another process is already sending this receipt" }, 200, cors);
      }
    }

    // Automatic post-payment sends also notify the owner, because a payment
    // taken while nobody is at the desk used to reach no one. This is a
    // SEPARATE email rather than a BCC of the customer's: Race needs the
    // things he has to act on (who, contact details, what to print), and the
    // customer must never see internal notes.
    const notifyOwner = body.notify_owner === true;
    const ownerAddr = (Deno.env.get("OWNER_NOTIFY_EMAIL") ?? REPLY_TO).trim().toLowerCase();
    const bcc: string[] = [];

    let token = s.view_token as string | null;
    if (!token) {
      // Sale predates the token column's default (or SQL not yet run for it).
      token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      const tokUpd = await admin.from("pos_sales").update({ view_token: token }).eq("id", saleId);
      if (tokUpd.error) {
        console.error("view_token backfill failed", tokUpd.error);
        return json({ error: "Run sql/pos-receipt-email.sql first (view_token column missing)" }, 500, cors);
      }
    }

    const paysRes = await admin.from("pos_payments").select("amount_cents").eq("sale_id", saleId);
    const paidNet = (paysRes.data ?? []).reduce((a, p) => a + p.amount_cents, 0);
    const balance = Math.max(s.total_cents - paidNet, 0);
    const paid = s.status === "paid";
    const closed = s.status === "closed";

    const brand = BRANDS[s.brand as string] ?? BRANDS.btkd;
    const legalLine = brand.dba ? `${LEGAL_ENTITY} · DBA ${brand.name}` : LEGAL_ENTITY;
    const shortId = saleId.slice(0, 8).toUpperCase();
    // Customers get our own domain, never a supabase.co URL - that page
    // wraps the same card the function renders (fragment mode).
    const viewUrl = `https://www.barestkd.fit/invoice/?t=${token}`;

    // Staff-editable bits. The intro line and an optional personal message are
    // the ONLY parts the caller controls - every figure, the link, the brand
    // and the legal footer are still derived here from the ledger. Both are
    // escaped, so a typo can never inject markup into a customer's inbox.
    // Wording follows the state. "Here is your invoice" reads wrong right
    // after somebody has handed over cash, so a partially-paid invoice
    // thanks them first and then names the balance.
    const partlyPaid = !paid && !closed && paidNet > 0;
    const defaultIntro = paid
      ? `Here's your receipt from ${brand.name}.`
      : partlyPaid
      ? `Thanks - we received ${money(paidNet)}. Here's your updated invoice from ${brand.name}.`
      : `Here's your invoice from ${brand.name}.`;
    const intro = esc(String(body.intro ?? "").trim().slice(0, 300) || defaultIntro);
    const note = String(body.note ?? "").trim().slice(0, 1200);
    // What they actually bought, in words: class dates, times, what to bring.
    // Written by whatever made the sale; never Race's internal `notes`.
    const custNote = String(s.customer_note ?? "").trim().slice(0, 1200);
    // A one-tap 'put this on my calendar'. Only ever a link we built
    // ourselves, and only https, so a bad row cannot inject a destination.
    const calUrl = String(s.calendar_url ?? "").trim();
    const calOk = calUrl.startsWith("https://calendar.google.com/") && calUrl.length < 2000;

    // ── short email: state + total + one big button ────────────────────────
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:440px;margin:0 auto;padding:20px 14px;text-align:center">
        ${brand.logo
          ? `<img src="${brand.logo}" alt="${esc(brand.name)}" style="max-width:220px;max-height:86px;margin-bottom:10px">`
          : `<h1 style="font-size:18px;margin:0 0 10px">${esc(brand.name)}</h1>`}
        <p style="font-size:14.5px;margin:6px 0 2px">${intro}</p>
        ${note ? `<p style="font-size:14px;line-height:1.6;margin:12px auto 2px;max-width:380px;text-align:left;white-space:pre-wrap">${esc(note)}</p>` : ""}
        ${custNote
          ? `<div style="text-align:left;max-width:380px;margin:14px auto 4px;padding:13px 15px;border-radius:10px;background:#F4F6F8;border-left:4px solid #15171C">
               <p style="font-size:14px;line-height:1.65;margin:0;white-space:pre-wrap">${esc(custNote)}</p>
             </div>`
          : ""}
        ${calOk
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:2px auto 12px">
               <tr><td bgcolor="#F4F6F8" style="border-radius:8px;border:1px solid #D9DEE3">
                 <a href="${calUrl}" style="display:inline-block;padding:11px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#15171C;text-decoration:none">
                   Add these classes to Google Calendar</a>
               </td></tr></table>`
          : ""}
        <p style="font-size:22px;font-weight:bold;margin:10px 0 2px">${money(s.total_cents)}</p>
        <p style="font-size:13px;margin:0 0 16px;${paid ? "color:#1e9e54" : closed ? "color:#6A727E" : "color:#c8102e"};font-weight:bold">
          ${paid ? "PAID - thank you!" : closed ? "Closed - no balance due" : `Balance due: ${money(balance)}`}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:4px auto 0">
          <tr><td bgcolor="#15171C" style="border-radius:8px">
            <a href="${viewUrl}" style="display:inline-block;padding:15px 38px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">
              View ${paid ? "receipt" : "invoice"} &rarr;</a>
          </td></tr>
        </table>
        <p style="font-size:11px;color:#999;margin-top:12px">Or paste this into your browser:<br>
          <a href="${viewUrl}" style="color:#999;word-break:break-all">${viewUrl}</a></p>
        <p style="font-size:11px;color:#777;margin-top:16px">Invoice ${shortId} · ${fmtDate(s.sale_date)}</p>
        <p style="font-size:10px;color:#999;margin-top:16px;line-height:1.6">${esc(legalLine)}<br>
          1901 Deerbrook Dr, Tyler, TX 75703 · 903-561-2966<br>
          Questions? Just reply to this email.</p>
      </div>`;

    const subject = paid
      ? `Your receipt from ${brand.name} - ${money(s.total_cents)}`
      : closed
      ? `Invoice ${shortId} from ${brand.name} - closed`
      : partlyPaid
      ? `Payment received - ${money(balance)} still due · ${brand.name}`
      : `Invoice from ${brand.name} - ${money(balance)} due`;

    // Preview: hand back exactly what would be sent, send nothing, touch
    // nothing. The CRM shows this before the staff member commits.
    if (body.preview === true) {
      return json({
        ok: true, preview: true, to, subject, html,
        default_intro: defaultIntro,
      }, 200, cors);
    }

    // ── the signed paperwork rides along as a PDF (owner request 2026-08-18):
    // buyer and owner both get a copy for the trail, on top of the stored
    // agreement on the student's profile. Built per send from the frozen
    // body_text, so it always prints exactly what was signed. A PDF failure
    // must never block the receipt.
    const attachments: Array<{ filename: string; content: string }> = [];
    try {
      const agr = await admin.from("membership_agreements")
        .select("document_title,body_text,signature_png,body_json")
        .eq("sale_id", saleId).limit(4);
      for (const a of agr.data ?? []) {
        if (!a.body_text) continue;
        const who = String((a.body_json as { participant?: string })?.participant ?? "").trim();
        const fname = (String(a.document_title || "Membership Agreement")
          + (who ? " - " + who : ""))
          .replace(/[^A-Za-z0-9 .-]/g, "").replace(/\s+/g, "-") + ".pdf";
        attachments.push({ filename: fname, content: await agreementPdf(a.body_text, a.signature_png) });
      }
    } catch (e) {
      console.error("agreement pdf failed", e);
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${brand.name} <receipts@barestkd.fit>`,
        to,
        ...(bcc.length ? { bcc } : {}),
        reply_to: REPLY_TO,
        subject,
        html,
        ...(attachments.length ? { attachments } : {}),
      }),
    });
    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      console.error("resend failed", resendRes.status, detail);
      // Give the claim back. We stamped receipt_sent_at to win the race, but
      // nothing was delivered, and leaving it stamped would mean this receipt
      // is never retried and never sent by anyone.
      if (internal) {
        await admin.from("pos_sales").update({ receipt_sent_at: null }).eq("id", saleId);
      }
      return json({ error: "Email send failed (" + resendRes.status + ")" }, 502, cors);
    }

    // ── the owner's own copy: what he has to do something about ───────────
    // Fire-and-forget. The customer's receipt has already gone; a failure to
    // notify Race must never turn a delivered receipt into an error.
    if (notifyOwner && paid && EMAIL_RE.test(ownerAddr)) {
      const buyerName = await (async () => {
        if (!s.buyer_contact_id) {
          // The name the payer TYPED, verbatim, marked as such. "Walk-in"
          // was a guess label printed while the real name sat in the sale;
          // it survives only for a sale where nobody typed anything at all
          // (owner, 2026-08-25: "just put the name they typed in on the
          // email for me, worst case").
          const typedName = String((s as Record<string, unknown>).payer_name ?? "").trim();
          const typedAddr = String((s as Record<string, unknown>).payer_email ?? "").trim();
          if (typedName) {
            return esc(typedName) + (typedAddr ? "<br>" + esc(typedAddr) : "")
              + '<br><span style="color:#c8102e;font-size:12px">typed at checkout, not matched to a profile</span>';
          }
          return "Walk-in";
        }
        const c = await admin.from("contacts")
          .select("first_name,last_name,email,phone").eq("id", s.buyer_contact_id).maybeSingle();
        if (!c.data) return "Unknown";
        const nm = [c.data.first_name, c.data.last_name].filter(Boolean).join(" ");
        const bits = [c.data.email, c.data.phone].filter(Boolean).join(" · ");
        // No date of birth here (owner 2026-08-21): a payment notice has no
        // use for it, and it was landing in an inbox that forwards.
        return [nm, bits].filter(Boolean).join("<br>");
      })();
      // What was bought, line by line, straight off the ledger. A desk sale
      // carries no customer_note, so the owner was getting an amount with no
      // item on it (owner 2026-08-21). "for <student>" when a line names one.
      const linesRes = await admin.from("pos_sale_lines")
        .select("label,qty,line_total_cents,student_contact_id").eq("sale_id", saleId);
      const lineRows = linesRes.data ?? [];
      const studentIds = [...new Set(lineRows.map((l) => l.student_contact_id).filter(Boolean))] as string[];
      const studentNames: Record<string, string> = {};
      if (studentIds.length) {
        const st = await admin.from("contacts").select("id,first_name,last_name").in("id", studentIds);
        for (const c of st.data ?? []) studentNames[c.id] = [c.first_name, c.last_name].filter(Boolean).join(" ");
      }
      const itemsHtml = lineRows.map((l) => {
        const qty = Number(l.qty ?? 1);
        const who = l.student_contact_id && studentNames[l.student_contact_id]
          ? ` <span style="color:#777">for ${esc(studentNames[l.student_contact_id])}</span>` : "";
        return `${qty > 1 ? qty + "&times; " : ""}${esc(String(l.label ?? ""))}${who}` +
          ` <span style="color:#777">&middot; ${money(Number(l.line_total_cents ?? 0))}</span>`;
      }).join("<br>");
      // What was actually bought, and when. customer_note is the line written
      // FOR a human ("Private lesson for Hunter, Wednesday, August 26 at 3:30
      // PM"); notes is the terse internal one ("Private lesson from the
      // website, 2026-08-26"). The owner gets customer_note because for a
      // lesson it carries the time he needs - EXCEPT testing sales, where
      // customer_note is the parent spiel (arrive early, full uniform) and
      // the terse note is the useful one: "paid by <parent>" plus any parent
      // comments. Owner, 2026-08-25: "i dont need a testing event description
      // in my confirmation sign up emails."
      const isTestingSale = String(s.staff_email ?? "").startsWith("testing-checkout");
      const ownerDetail = isTestingSale
        ? String(s.notes ?? "").trim()
        : (String(s.customer_note ?? "").trim() || String(s.notes ?? "").trim());
      const ownerHtml =
        `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:460px;margin:0 auto;padding:18px 14px">
          <p style="font-size:12px;letter-spacing:.08em;color:#777;margin:0 0 4px">PAYMENT RECEIVED</p>
          <p style="font-size:26px;font-weight:bold;margin:0 0 14px">${money(s.total_cents)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:1.6">
            <tr><td style="color:#777;padding-right:12px;vertical-align:top">Who</td><td>${buyerName}</td></tr>
            ${to.some((a) => !String(buyerName).toLowerCase().includes(String(a).toLowerCase()))
              ? `<tr><td style="color:#777;padding-right:12px;vertical-align:top">Receipt to</td><td>${esc(to.join(", "))}</td></tr>`
              : ""}
            ${itemsHtml ? `<tr><td style="color:#777;padding-right:12px;vertical-align:top">Items</td><td>${itemsHtml}</td></tr>` : ""}
            ${ownerDetail ? `<tr><td style="color:#777;padding-right:12px;vertical-align:top">Details</td><td style="white-space:pre-wrap">${esc(ownerDetail)}</td></tr>` : ""}
            <tr><td style="color:#777;padding-right:12px;vertical-align:top">Invoice</td><td>${shortId} · ${fmtDate(s.sale_date)}</td></tr>
          </table>
          <p style="margin:18px 0 0"><a href="${viewUrl}" style="font-size:14px;font-weight:bold;color:#15171C">Open the invoice &rarr;</a></p>
        </div>`;
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${brand.name} <receipts@barestkd.fit>`,
          to: [ownerAddr],
          reply_to: to[0] || REPLY_TO,   // replying goes to the customer
          subject: `Paid: ${money(s.total_cents)} · ${String(buyerName).replace(/<br>.*/s, "")}`,
          html: ownerHtml,
          ...(attachments.length ? { attachments } : {}),
        }),
      }).then((r) => { if (!r.ok) console.error("owner notify failed", r.status); })
        .catch((e) => console.error("owner notify threw", e));
    }

    // ── stamp the sale so the CRM shows it went out ────────────────────────
    // An automatic send already claimed receipt_sent_at above; this fills in
    // the address. A manual send stamps both, as it always did.
    const stamp: Record<string, unknown> = { receipt_email: to[0] };
    if (!internal) stamp.receipt_sent_at = new Date().toISOString();
    const upd = await admin.from("pos_sales").update(stamp).eq("id", saleId);
    if (upd.error) console.error("receipt stamp failed", upd.error); // email DID send

    return json({ ok: true, to, bcc, paid }, 200, cors);
  } catch (e) {
    console.error("send-receipt error", e);
    return json({ error: "Internal error" }, 500, cors);
  }
});
