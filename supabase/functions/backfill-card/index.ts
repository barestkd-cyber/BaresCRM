// ===========================================================================
// One-off: fill in the card brand and last four on payments that were
// recorded without them.
// ---------------------------------------------------------------------------
// The emailed-invoice payment path never captured the card (fixed 2026-09-04),
// so payments taken that way say "card" and nothing else. This walks the rows
// that have a Stripe object but no last four, asks Stripe what the card was,
// and fills it in. Money is never touched - only the two descriptive columns.
//
// Runs server-side so the Stripe key is never handled outside Supabase.
// Deployed, run once, and deleted; it exists in git as the record of what was
// done rather than as a live endpoint.
//
//   supabase functions deploy backfill-card --no-verify-jwt
//   supabase functions invoke backfill-card --body '{"confirm":"yes"}'
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cardBits(obj: Record<string, unknown>): { card_brand: string | null; card_last4: string | null } {
  const seen = new Set<unknown>();
  const walk = (o: unknown, depth: number): Record<string, unknown> | null => {
    if (!o || typeof o !== "object" || depth > 5 || seen.has(o)) return null;
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

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "yes") {
    return new Response(JSON.stringify({ error: 'send {"confirm":"yes"}' }), { status: 400 });
  }
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return new Response(JSON.stringify({ error: "no stripe key" }), { status: 503 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const rows = await admin.from("pos_payments")
    .select("id,stripe_object_id,amount_cents")
    .is("card_last4", null)
    .not("stripe_object_id", "is", null);
  if (rows.error) return new Response(JSON.stringify({ error: rows.error.message }), { status: 500 });

  const out: Record<string, unknown>[] = [];
  for (const p of rows.data ?? []) {
    const id = String(p.stripe_object_id);
    // Only payment intents; a charge or a session id is a different endpoint
    // and this is not the place to guess at one.
    if (!id.startsWith("pi_")) { out.push({ id: p.id, skipped: "not a payment intent" }); continue; }
    try {
      const r = await fetch(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`,
        { headers: { Authorization: "Bearer " + key } },
      );
      const pi = await r.json();
      if (!r.ok) { out.push({ id: p.id, error: pi?.error?.message ?? r.status }); continue; }
      const bits = cardBits(pi);
      if (!bits.card_last4) { out.push({ id: p.id, skipped: "stripe has no card on it" }); continue; }
      const upd = await admin.from("pos_payments").update(bits).eq("id", p.id);
      out.push(upd.error ? { id: p.id, error: upd.error.message }
        : { id: p.id, filled: `${bits.card_brand} ${bits.card_last4}`, amount: p.amount_cents });
    } catch (e) {
      out.push({ id: p.id, error: String(e) });
    }
  }
  return new Response(JSON.stringify({ examined: (rows.data ?? []).length, results: out }, null, 1),
    { headers: { "Content-Type": "application/json" } });
});
