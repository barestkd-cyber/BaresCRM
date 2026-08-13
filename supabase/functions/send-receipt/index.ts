// ===========================================================================
// Supabase Edge Function: send-receipt
// ---------------------------------------------------------------------------
// Emails a SHORT branded receipt/invoice notification with a "View receipt"
// button linking to the live view-only page (receipt-view, addressed by the
// sale's view_token). The email deliberately carries only the total and
// paid/due state — the link is the receipt.
//
// HARD RULES:
//   1. STAFF-ONLY. Deployed WITH JWT verification (no --no-verify-jwt), and
//      additionally checks is_staff() with the caller's own token.
//   2. The client sends ONLY { sale_id, to: [emails] } — the ledger row is
//      the source of everything rendered. Max 3 recipients.
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

const ALLOWED_ORIGINS = ["https://crm.barestkd.fit"];
const REPLY_TO = "race@barestkd.fit";
const LEGAL_ENTITY = "Grizzly Martial Arts and Fitness LLC";

// Brand catalog — keep aligned with RECEIPT_BRANDS in BaresCRM/index.html.
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

    // ── caller must be staff ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not signed in" }, 401, cors);
    const { data: staffOk, error: staffErr } = await caller.rpc("is_staff");
    if (staffErr || staffOk !== true) return json({ error: "Staff only" }, 403, cors);

    // ── input: sale id + recipient list, nothing else trusted ──────────────
    const body = await req.json().catch(() => ({}));
    const saleId = String(body.sale_id ?? "").trim();
    const toRaw: unknown[] = Array.isArray(body.to) ? body.to : [body.to];
    const to = [...new Set(toRaw.map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean))];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saleId)) {
      return json({ error: "Bad sale_id" }, 400, cors);
    }
    if (!to.length || to.length > 3 || to.some((t) => !EMAIL_RE.test(t) || t.length > 200)) {
      return json({ error: "Bad recipient list (1-3 valid emails)" }, 400, cors);
    }

    // ── load the sale; make sure it has a view token ────────────────────────
    const admin = createClient(url, serviceKey);
    const saleRes = await admin.from("pos_sales")
      .select("id,status,brand,total_cents,sale_date,view_token")
      .eq("id", saleId).single();
    if (saleRes.error || !saleRes.data) return json({ error: "Sale not found" }, 404, cors);
    const s = saleRes.data;

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
    const viewUrl = `${url}/functions/v1/receipt-view?t=${token}`;

    // ── short email: state + total + one big button ────────────────────────
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:440px;margin:0 auto;padding:20px 14px;text-align:center">
        ${brand.logo
          ? `<img src="${brand.logo}" alt="${esc(brand.name)}" style="max-width:220px;max-height:86px;margin-bottom:10px">`
          : `<h1 style="font-size:18px;margin:0 0 10px">${esc(brand.name)}</h1>`}
        <p style="font-size:14.5px;margin:6px 0 2px">Here's your ${paid ? "receipt" : "invoice"} from ${esc(brand.name)}.</p>
        <p style="font-size:22px;font-weight:bold;margin:10px 0 2px">${money(s.total_cents)}</p>
        <p style="font-size:13px;margin:0 0 16px;${paid ? "color:#1e9e54" : closed ? "color:#6A727E" : "color:#c8102e"};font-weight:bold">
          ${paid ? "PAID — thank you!" : closed ? "Closed — no balance due" : `Balance due: ${money(balance)}`}</p>
        <a href="${viewUrl}"
           style="display:inline-block;background:#15171C;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 34px;border-radius:8px">
           View ${paid ? "receipt" : "invoice"}</a>
        <p style="font-size:11px;color:#777;margin-top:16px">Invoice ${shortId} · ${esc(s.sale_date)}</p>
        <p style="font-size:10px;color:#999;margin-top:16px;line-height:1.6">${esc(legalLine)}<br>
          1901 Deerbrook Dr, Tyler, TX 75703 · 903-561-2966<br>
          Questions? Just reply to this email.</p>
      </div>`;

    const subject = paid
      ? `Your receipt from ${brand.name} — ${money(s.total_cents)}`
      : closed
      ? `Invoice ${shortId} from ${brand.name} — closed`
      : `Invoice from ${brand.name} — ${money(balance)} due`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${brand.name} <receipts@barestkd.fit>`,
        to,
        reply_to: REPLY_TO,
        subject,
        html,
      }),
    });
    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      console.error("resend failed", resendRes.status, detail);
      return json({ error: "Email send failed (" + resendRes.status + ")" }, 502, cors);
    }

    // ── stamp the sale so the CRM shows it went out ────────────────────────
    const upd = await admin.from("pos_sales")
      .update({ receipt_email: to[0], receipt_sent_at: new Date().toISOString() })
      .eq("id", saleId);
    if (upd.error) console.error("receipt stamp failed", upd.error); // email DID send

    return json({ ok: true, to, paid }, 200, cors);
  } catch (e) {
    console.error("send-receipt error", e);
    return json({ error: "Internal error" }, 500, cors);
  }
});
