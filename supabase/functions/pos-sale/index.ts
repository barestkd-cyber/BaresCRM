// ===========================================================================
// Supabase Edge Function: pos-sale  (Stripe plan Phase A2)
// ---------------------------------------------------------------------------
// The authoritative sale writer. The POS client sends INTENT — which plans,
// for whom, which products, what discount — and this function re-derives
// every price itself from pricing_plans/pricing_settings/products and the
// buyer's real household, using the SAME vendored pricing engine the browser
// and the Node tests run (_shared/pricing_esm.js, generated from pricing.js;
// the test suite fails if it drifts). The client's displayed total is treated
// as a QUOTE to verify, never as an instruction: any mismatch is a 409 and
// nothing is written.
//
// HARD RULES:
//   1. STAFF-ONLY. Deployed WITH JWT verification; also checks is_staff().
//   2. The client never supplies a money amount that reaches the database —
//      EXCEPT event lines (the events catalog is still a client-side mock;
//      documented exception, dies when real events land).
//   3. sale_id is client-minted and is the idempotency key: a duplicate
//      submit (PK conflict) returns the existing sale as success.
//   4. Writes happen in dependency order; any hard failure before the sale
//      header aborts clean. After the header, problems are REPORTED, never
//      hidden (mirrors the A1 client behavior).
//   5. Money is integer cents everywhere.
//
// Deploy, from the BaresCRM repo root:
//   supabase functions deploy pos-sale
// ===========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import BTKDPricing from "../_shared/pricing_esm.js";

const ALLOWED_ORIGINS = ["https://crm.barestkd.fit"];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cents = (n: unknown) => Math.round(Number(n) || 0);

// TKD track routing by age, mirroring posTkdTrackFor (age >= 13 → Teens/Adults).
function tkdTrackFor(dob: string | null): string {
  if (!dob) return "Juniors";
  const age = Math.floor((Date.now() - new Date(dob).getTime()) / 3.15576e10);
  return age >= 13 ? "Teens/Adults" : "Juniors";
}

// Enrollment programs a sold membership implies — mirrors posMemRosterPrograms.
function rosterPrograms(calc: any, dob: string | null): string[] {
  const p = calc.program || "";
  if (calc.category === "weekly_bundle") {
    return calc.planCode === "bundle_tkd_both_specialties"
      ? [tkdTrackFor(dob), "Kickboxing", "Jiu Jitsu"] : [tkdTrackFor(dob)];
  }
  if (p === "Kickboxing + Jiu Jitsu") return ["Kickboxing", "Jiu Jitsu"];
  if (p) return [p];
  if (calc.category === "core_tkd") return [tkdTrackFor(dob)];
  if (calc.category === "cubs") return ["Cubs"];
  return [];
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── caller must be staff ────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not signed in" }, 401, cors);
    const { data: staffOk, error: staffErr } = await caller.rpc("is_staff");
    if (staffErr || staffOk !== true) return json({ error: "Staff only" }, 403, cors);
    const staffEmail = userData.user.email ?? "unknown";

    // ── parse intent ────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const saleId = String(body.sale_id ?? "").trim();
    const tender = String(body.tender_method ?? "").trim(); // cash|check|card|unpaid
    const buyerId = body.buyer_contact_id ? String(body.buyer_contact_id) : null;
    const saleDate = String(body.sale_date ?? "").trim();
    const brand = ["btkd", "gbs", "gmaf"].includes(body.brand) ? body.brand : "btkd";
    const notes = body.notes ? String(body.notes).slice(0, 2000) : null;
    const discountCents = Math.max(cents(body.discount_cents), 0);
    const adminFeeCents = Math.max(cents(body.admin_fee_cents), 0);
    const clientTotal = cents(body.client_total_cents);
    const intent: any[] = Array.isArray(body.lines) ? body.lines : [];

    if (!UUID_RE.test(saleId)) return json({ error: "Bad sale_id" }, 400, cors);
    if (!["cash", "check", "card", "unpaid"].includes(tender)) return json({ error: "Bad tender_method" }, 400, cors);
    if (buyerId && !UUID_RE.test(buyerId)) return json({ error: "Bad buyer_contact_id" }, 400, cors);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return json({ error: "Bad sale_date" }, 400, cors);
    if (!intent.length || intent.length > 30) return json({ error: "1-30 lines" }, 400, cors);

    const admin = createClient(url, serviceKey);

    // ── idempotency: same sale_id already recorded → success, no rewrite ────
    const existing = await admin.from("pos_sales").select("id,total_cents,status").eq("id", saleId).maybeSingle();
    if (existing.data) {
      return json({ ok: true, duplicate: true, sale_id: saleId, total_cents: existing.data.total_cents, badges: [], notes: ["Already recorded — duplicate submit ignored."], problems: [] }, 200, cors);
    }

    // ── load catalog + settings once ────────────────────────────────────────
    const [plansRes, settingsRes, productsRes] = await Promise.all([
      admin.from("pricing_plans").select("*"),
      admin.from("pricing_settings").select("*"),
      admin.from("products").select("*"),
    ]);
    if (plansRes.error || settingsRes.error || productsRes.error) {
      return json({ error: "Catalog load failed" }, 500, cors);
    }
    const PLANS = plansRes.data ?? [];
    const SETTINGS = settingsRes.data ?? [];
    const PRODUCTS = productsRes.data ?? [];
    const planByCode = (code: string) => PLANS.find((p) => p.code === code) || null;

    // ── pricing context per student (household-aware), server-derived ───────
    async function pricingContext(contactId: string) {
      const hm = await admin.from("household_members").select("household_id").eq("contact_id", contactId);
      let ids = [contactId];
      if ((hm.data ?? []).length) {
        const hhIds = hm.data!.map((r) => r.household_id);
        const all = await admin.from("household_members").select("contact_id").in("household_id", hhIds);
        ids = [...new Set([contactId, ...(all.data ?? []).map((r) => r.contact_id)])];
      }
      const ms = await admin.from("memberships")
        .select("contact_id,plan_code,status,started_on,billing_frequency")
        .in("contact_id", ids);
      const byContact: Record<string, any[]> = {};
      ids.forEach((id) => { byContact[id] = []; });
      (ms.data ?? []).forEach((r) => {
        const pl = planByCode(r.plan_code);
        (byContact[r.contact_id] = byContact[r.contact_id] || []).push({
          plan_code: r.plan_code,
          category: pl ? pl.category : null,
          status: r.status,
          started_on: r.started_on,
          billing_frequency: r.billing_frequency || (pl ? pl.billing_frequency : null),
        });
      });
      return {
        person: { contact_id: contactId, activeMemberships: byContact[contactId] || [] },
        householdMembers: ids.filter((id) => id !== contactId)
          .map((id) => ({ contact_id: id, activeMemberships: byContact[id] || [] })),
      };
    }

    // ── price every line server-side ────────────────────────────────────────
    type Priced = {
      kind: string; label: string; qty: number; unit_cents: number;
      discount_cents: number; taxable: boolean; line_total_cents: number;
      student_contact_id: string | null; product_id: string | null;
      membership_row: any | null; calc?: any; studentDob?: string | null;
    };
    const priced: Priced[] = [];
    const dobById: Record<string, string | null> = {};

    for (const l of intent) {
      const kind = String(l.kind ?? "");
      if (kind === "mem") {
        const studentId = String(l.student_id ?? "");
        const planCode = String(l.plan_code ?? "");
        if (!UUID_RE.test(studentId)) return json({ error: "Membership line missing student" }, 400, cors);
        const plan = planByCode(planCode);
        if (!plan) return json({ error: "Unknown plan: " + planCode }, 400, cors);
        if (dobById[studentId] === undefined) {
          const c = await admin.from("contacts").select("dob").eq("id", studentId).single();
          if (c.error || !c.data) return json({ error: "Unknown student on membership line" }, 400, cors);
          dobById[studentId] = c.data.dob;
        }
        const ctx = await pricingContext(studentId);
        const calc = BTKDPricing.calculatePrice({
          plan, settings: SETTINGS, person: ctx.person,
          householdMembers: ctx.householdMembers, plans: PLANS,
        });
        if (!calc.eligible) return json({ error: "Not eligible: " + (calc.eligibilityReason || planCode) }, 409, cors);
        // Override: client sends the numbers + reason; identity/time stamped HERE.
        let override = null;
        if (l.override && l.override.recurringCents != null) {
          const reason = String(l.override.reason ?? "").trim();
          if (!reason) return json({ error: "Override needs a reason" }, 400, cors);
          override = {
            active: true,
            recurringCents: cents(l.override.recurringCents),
            downCents: l.override.downCents != null ? cents(l.override.downCents) : null,
            reason, by: staffEmail, at: new Date().toISOString(),
          };
        }
        const due = BTKDPricing.dueTodayCents(calc, override);
        const row = BTKDPricing.buildMembershipSnapshot({
          calc, contactId: studentId, program: calc.program,
          startedOn: saleDate, createdBy: staffEmail, override,
        });
        // Session plans expire: end date baked in at sale time (nightly sweep
        // flips status to ended). Mirrors the A1 client stamp exactly.
        if (plan.duration_weeks) {
          const dt = new Date(saleDate + "T00:00:00Z");
          dt.setUTCDate(dt.getUTCDate() + plan.duration_weeks * 7);
          (row as any).ended_on = dt.toISOString().slice(0, 10);
        }
        priced.push({
          kind: "mem", label: calc.planName || planCode, qty: 1, unit_cents: due,
          discount_cents: 0, taxable: false, line_total_cents: due,
          student_contact_id: studentId, product_id: null,
          membership_row: row, calc, studentDob: dobById[studentId],
        });
      } else if (kind === "prod") {
        const prodId = String(l.product_id ?? "");
        const qty = Math.min(Math.max(Math.round(Number(l.qty) || 1), 1), 99);
        const p = PRODUCTS.find((x) => x.id === prodId);
        if (!p) return json({ error: "Unknown product" }, 400, cors);
        const unit = p.price_cents;
        const gross = unit * qty;
        let disc = 0;
        if (l.disc_type === "amt") disc = Math.min(cents(l.disc_val) * qty, gross);
        else if (l.disc_type === "pct") {
          const pct = Math.min(Math.max(Number(l.disc_val) || 0, 0), 100);
          disc = Math.round(gross * pct / 100);
        }
        priced.push({
          kind: "prod", label: p.name, qty, unit_cents: unit,
          discount_cents: disc, taxable: p.taxable !== false,
          line_total_cents: gross - disc,
          student_contact_id: null, product_id: p.id, membership_row: null,
        });
      } else if (kind === "event") {
        if (l.event_id && UUID_RE.test(String(l.event_id))) {
          // Real event: price from the events table, never from the client.
          const ev = await admin.from("events").select("id,label,price_cents,active").eq("id", String(l.event_id)).single();
          if (ev.error || !ev.data || ev.data.active === false || ev.data.price_cents == null) return json({ error: "Unknown or inactive event" }, 400, cors);
          priced.push({
            kind: "event", label: ev.data.label, qty: 1,
            unit_cents: ev.data.price_cents, discount_cents: 0, taxable: false,
            line_total_cents: ev.data.price_cents,
            student_contact_id: null, product_id: null, membership_row: null,
            eventId: ev.data.id,
          } as Priced & { eventId: string });
        } else {
          // DOCUMENTED EXCEPTION: mock events (pre-table) pass the amount as
          // sent. Bounded; dies when the events table is the only path.
          const amt = cents(l.cents);
          if (amt < 0 || amt > 500000) return json({ error: "Bad event amount" }, 400, cors);
          priced.push({
            kind: "event", label: String(l.label ?? "Event").slice(0, 200), qty: 1,
            unit_cents: amt, discount_cents: 0, taxable: false, line_total_cents: amt,
            student_contact_id: null, product_id: null, membership_row: null,
          });
        }
      } else {
        return json({ error: "Unknown line kind: " + kind }, 400, cors);
      }
    }

    // ── authoritative totals; the client's number is only a checksum ────────
    const taxRate = 0.0825;
    const totals = BTKDPricing.invoiceTotals({
      lines: priced.map((p) => ({ cents: p.line_total_cents, taxable: p.taxable })),
      discountCents, adminFeeCents, taxRate,
    });
    if (clientTotal !== totals.totalCents) {
      return json({
        error: "Price changed — reload the POS and re-ring this sale.",
        server_total_cents: totals.totalCents, client_total_cents: clientTotal,
      }, 409, cors);
    }

    // ── writes, dependency order ────────────────────────────────────────────
    const isUnpaid = tender === "unpaid";
    const badges: string[] = [], notesOut: string[] = [], problems: string[] = [];

    const ins = await admin.from("pos_sales").insert({
      id: saleId, buyer_contact_id: buyerId, sale_date: saleDate,
      staff_email: staffEmail, brand,
      tender_method: isUnpaid ? null : tender,
      status: isUnpaid ? "unpaid" : "paid",
      subtotal_cents: totals.subtotalCents, discount_cents: totals.discountCents,
      admin_fee_cents: totals.adminFeeCents, tax_cents: totals.taxCents,
      total_cents: totals.totalCents, notes,
      confirmed_at: isUnpaid ? null : new Date().toISOString(),
    });
    if (ins.error) {
      if (ins.error.code === "23505") {
        return json({ ok: true, duplicate: true, sale_id: saleId, total_cents: totals.totalCents, badges, notes: ["Already recorded — duplicate submit ignored."], problems }, 200, cors);
      }
      return json({ error: "Sale write failed: " + ins.error.message }, 500, cors);
    }

    // memberships + enrollments per student
    const byStudent: Record<string, Priced[]> = {};
    priced.filter((p) => p.kind === "mem").forEach((p) => {
      (byStudent[p.student_contact_id!] = byStudent[p.student_contact_id!] || []).push(p);
    });
    for (const studentId of Object.keys(byStudent)) {
      const rows = byStudent[studentId].map((p) => ({ ...p.membership_row, sale_id: saleId }));
      const mi = await admin.from("memberships").insert(rows).select("id");
      if (mi.error) {
        problems.push("Membership write failed for a student: " + mi.error.message);
        continue;
      }
      byStudent[studentId].forEach((p, i) => { p.membership_row.__id = mi.data?.[i]?.id ?? null; });
      badges.push("Membership saved");
      const want = [...new Set(byStudent[studentId].flatMap((p) => rosterPrograms(p.calc, p.studentDob ?? null)))];
      if (want.length) {
        const have = await admin.from("enrollments").select("program").eq("student_id", studentId);
        const existing2 = (have.data ?? []).map((r) => r.program);
        const add = want.filter((p) => !existing2.includes(p))
          .map((p) => ({ student_id: studentId, program: p, status: "active", sale_id: saleId }));
        if (add.length) {
          const ei = await admin.from("enrollments").insert(add);
          if (ei.error) problems.push("Roster not updated: " + ei.error.message);
          else badges.push("Added to " + add.map((r) => r.program).join(", "));
        }
      }
    }

    const lineRows = priced.map((p) => ({
      sale_id: saleId, kind: p.kind, label: p.label, qty: p.qty,
      unit_cents: p.unit_cents, discount_cents: p.discount_cents,
      taxable: p.taxable, line_total_cents: p.line_total_cents,
      student_contact_id: p.student_contact_id, product_id: p.product_id,
      membership_row: p.membership_row ? (({ __id, ...r }) => r)(p.membership_row) : null,
      membership_id: p.membership_row?.__id ?? null,
    }));
    const li = await admin.from("pos_sale_lines").insert(lineRows);
    if (li.error) problems.push("Line detail failed: " + li.error.message);

    // Real-event registrations, sale-linked; duplicate registration is a no-op.
    const evLines = priced.filter((p: any) => p.eventId);
    if (evLines.length) {
      if (buyerId) {
        const regs = evLines.map((p: any) => ({ event_id: p.eventId, contact_id: buyerId, sale_id: saleId }));
        const er = await admin.from("event_registrations").upsert(regs, { onConflict: "event_id,contact_id", ignoreDuplicates: true });
        if (er.error) problems.push("Event registration failed: " + er.error.message);
        else badges.push("On event list");
      } else {
        problems.push("Event sold to a walk-in — no registration recorded.");
      }
    }

    if (!isUnpaid) {
      const pi = await admin.from("pos_payments").insert({
        sale_id: saleId, kind: "charge", amount_cents: totals.totalCents,
        method: tender, note: tender.charAt(0).toUpperCase() + tender.slice(1),
      });
      if (pi.error) problems.push("Payment row failed: " + pi.error.message);
    } else {
      notesOut.push("Saved as an unpaid invoice.");
    }

    return json({ ok: true, sale_id: saleId, total_cents: totals.totalCents, badges, notes: notesOut, problems }, 200, cors);
  } catch (e) {
    console.error("pos-sale error", e);
    return json({ error: "Internal error" }, 500, cors);
  }
});
