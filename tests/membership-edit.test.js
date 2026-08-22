/* ============================================================================
 * Editing a live membership
 * ----------------------------------------------------------------------------
 *     node tests/membership-edit.test.js
 *
 * The membership row is the answer to "what are they billed". Editing it is
 * legitimate, but a frozen snapshot that can be quietly rewritten is worth
 * nothing, so what matters is that every change is recorded with what it was
 * before, and that a save cannot happen without a reason.
 *
 * These test the DECISION logic lifted out of the CRM rather than the DOM:
 * which fields count as changed, and what the trail says about them.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ok   ' + name); passed++; }
  catch (e) { failed++; console.error('  FAIL ' + name + '\n       ' + (e && e.message)); }
}

/* MEM_FIELDS is the list the editor diffs against. Lifted so the test breaks
 * if a field is added to the form without being added to the trail. */
const m = /const MEM_FIELDS = \[([\s\S]*?)\];/.exec(html);
assert.ok(m, 'MEM_FIELDS not found in the CRM');
const MEM_FIELDS = eval('[' + m[1] + ']');

test('every editable field is in the change list', () => {
  const keys = MEM_FIELDS.map((f) => f.key);
  ['final_recurring_cents', 'billing_frequency', 'next_bill_on', 'status']
    .forEach((k) => assert.ok(keys.includes(k), k + ' is editable but would not be recorded'));
});

test('everything about the deal is editable, program and plan included', () => {
  // Owner, 2026-08-21: "i want to be able to edit program and option. As long
  // as youre tracking changes i want to change whatever i want." An earlier
  // version of this test asserted the opposite; he overruled it, and full
  // control with a trail is a legitimate way to run a studio.
  const keys = MEM_FIELDS.map((f) => f.key);
  ['program', 'plan_code', 'final_recurring_cents', 'billing_frequency',
   'next_bill_on', 'started_on', 'ended_on', 'payer_contact_id', 'status']
    .forEach((k) => assert.ok(keys.includes(k), k + ' must be editable'));
});

test('changing program or plan warns that the agreement no longer matches', () => {
  // The lock is replaced by a warning, not by nothing. Losing the warning
  // would let the paperwork and the record drift apart silently.
  assert.ok(/function memEditDrift\(\)/.test(html), 'memEditDrift is missing');
  const fn = /function memEditDrift\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(fn, 'could not read memEditDrift');
  assert.ok(/me-program/.test(fn[1]) && /me-plan/.test(fn[1]),
    'the warning must watch BOTH program and plan');
  assert.ok(/me-agr-warn/.test(fn[1]), 'it must show the agreement warning');
});

test('the whole term is editable, not just where it ends', () => {
  // Owner: "full membership duration not just end date."
  const keys = MEM_FIELDS.map((f) => f.key);
  assert.ok(keys.includes('started_on') && keys.includes('ended_on'),
    'both ends of the term must be editable');
});

/* The diff the editor performs, reproduced exactly. */
function changedFields(before, next) {
  return MEM_FIELDS.filter((f) => String(before[f.key] ?? '') !== String(next[f.key] ?? ''));
}

test('only what actually moved is recorded', () => {
  const before = { final_recurring_cents: 9000, billing_frequency: 'monthly', next_bill_on: '2026-09-01', status: 'active' };
  const next = { ...before, final_recurring_cents: 8000 };
  const ch = changedFields(before, next);
  assert.strictEqual(ch.length, 1);
  assert.strictEqual(ch[0].key, 'final_recurring_cents');
});

test('saving with nothing changed records nothing', () => {
  const before = { final_recurring_cents: 9000, billing_frequency: 'monthly', next_bill_on: '2026-09-01', status: 'active' };
  assert.strictEqual(changedFields(before, { ...before }).length, 0);
});

test('clearing a billing date counts as a change, not as unchanged', () => {
  // null and "" and undefined all have to compare equal to each other but not
  // to a real date, or clearing a date would slip through unrecorded.
  const before = { final_recurring_cents: 9000, billing_frequency: 'monthly', next_bill_on: '2026-09-01', status: 'active' };
  const next = { ...before, next_bill_on: null };
  assert.strictEqual(changedFields(before, next).length, 1);
  const both = { ...before, next_bill_on: null };
  assert.strictEqual(changedFields(both, { ...both, next_bill_on: '' }).length, 0);
});

test('a reason is required before anything is written', () => {
  const src = /async function memEditSave\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memEditSave not found');
  const body = src[1];
  const reasonGate = body.indexOf('Say why');
  const update = body.indexOf("from('memberships').update");
  assert.ok(reasonGate > -1, 'no reason gate');
  assert.ok(update > -1, 'no update call');
  assert.ok(reasonGate < update, 'the reason is checked AFTER the row is written');
});

test('the sale-time override audit is never overwritten by an edit', () => {
  // override_reason/by/at record the price override made at the POINT OF SALE.
  // An edit writing to them would erase how the sale itself was priced.
  const src = /async function memEditSave\(\)\{([\s\S]*?)\n\}/.exec(html)[1];
  ['override_reason', 'override_by', 'override_at'].forEach((f) =>
    assert.ok(!src.includes(f), 'memEditSave touches ' + f));
});

/* ── the payment schedule ────────────────────────────────── */

test('schedule edits demand a reason before any row is written', () => {
  const src = /async function memSchedSave\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memSchedSave not found');
  const body = src[1];
  const gate = body.indexOf('Say why');
  const write = body.indexOf('membership_installments").update');
  assert.ok(gate > -1 && write > -1 && gate < write, 'the reason gate must come before the write');
});

test('an installment invoice is untaxed, fee-free, and unpaid at creation', () => {
  const src = /async function memSchedInvoice\(id\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memSchedInvoice not found');
  const body = src[1];
  assert.ok(/status:"unpaid"/.test(body), 'must be created unpaid, never paid');
  assert.ok(/tax_cents:0/.test(body), 'a membership payment is a service, untaxed');
  assert.ok(/admin_fee_cents:0/.test(body), 'no card fee at creation; the fee question belongs to the charging engine');
  assert.ok(/taxable:false/.test(body), 'the line must be untaxed too');
  ['override_reason', 'override_by'].forEach((x) =>
    assert.ok(!body.includes(x), x + ' must not be touched'));
});

test('a paid, invoiced or waived installment cannot be edited in place', () => {
  const src = /function memSchedRender\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memSchedRender not found');
  assert.ok(/locked = st\[0\]!=="Scheduled"/.test(src[1]),
    'only Scheduled rows may be edited; everything else locks');
});

test('the generator uses the engine, never local date math', () => {
  const src = /async function memSchedGenerate\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memSchedGenerate not found');
  assert.ok(/BTKDPricing\.installmentSchedule\(/.test(src[1]),
    'dates must come from the tested engine generator');
});

/* ── fixes from the 2026-08-20 adversarial review ─────────────────── */

test('Bill now bills the price on screen, not a stale cached one', () => {
  const src = /async function memSchedInvoice\(id\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'memSchedInvoice not found');
  const body = src[1];
  assert.ok(/data-if=.amt./.test(body),
    'must read the row\'s own amount box before billing');
  const readBox = body.search(/data-if=.amt./);
  const insert = body.indexOf('from("pos_sales").insert');
  assert.ok(readBox > -1 && insert > -1 && readBox < insert,
    'the typed price must be read BEFORE the invoice is created');
});

test('Bill now cannot double-bill: guarded, and re-checks the row', () => {
  const src = /async function memSchedInvoice\(id\)\{([\s\S]*?)\n\}/.exec(html);
  const body = src[1];
  assert.ok(/MEM_SCHED_BUSY/.test(body), 'needs an in-flight guard against a double tap');
  const recheck = body.indexOf('.select("status,sale_id")');
  const insert = body.indexOf('from("pos_sales").insert');
  assert.ok(recheck > -1 && recheck < insert,
    'must re-read the row before creating a second sale for it');
  assert.ok(/is\("sale_id", null\)/.test(body),
    'the link must be conditional so two callers cannot both claim it');
});

test('a failed link or line unwinds the invoice instead of reporting success', () => {
  const src = /async function memSchedInvoice\(id\)\{([\s\S]*?)\n\}/.exec(html);
  const body = src[1];
  const deletes = (body.match(/from\("pos_sales"\)\.delete\(\)/g) || []).length;
  assert.ok(deletes >= 2,
    'both the line failure and the link failure must remove the orphan sale');
  assert.ok(!/if\(lErr\) console\.error\("installment invoice line", lErr\);\s*const/.test(body),
    'a failed line must not be swallowed');
});

test('deleting an invoice releases its scheduled payment', () => {
  const src = /async function posDeleteInvoice\(saleId\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'posDeleteInvoice not found');
  const body = src[1];
  const rel = body.indexOf('membership_installments');
  const del = body.indexOf("from('pos_sales').delete()");
  assert.ok(rel > -1 && del > -1 && rel < del,
    'the installment must be released BEFORE the sale row is deleted');
  assert.ok(/status:'scheduled', sale_id:null/.test(body),
    'releasing means back to scheduled with no sale');
});

test('a partly-applied save still records what changed', () => {
  const src = /async function memSchedSave\(\)\{([\s\S]*?)\n\}/.exec(html);
  const body = src[1];
  assert.ok(/const done=\[\]/.test(body), 'must track which edits actually landed');
  assert.ok(/trail=done\.map/.test(body),
    'the audit trail must be built from what landed, not from what was attempted');
});

test('a cleared amount box means no change, never free', () => {
  const src = /async function memSchedSave\(\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(/if\(!String\(el\.value\|\|""\)\.trim\(\)\) return;/.test(src[1]),
    'an empty amount must be skipped, not parsed as 0');
});

test('remaining payments counts a paid invoice as settled', () => {
  const src = /async function loadProfileMemberships\(contactId\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'loadProfileMemberships not found');
  const body = src[1];
  assert.ok(/x\.settled/.test(body), 'settled-ness must be computed');
  assert.ok(/paidSale\[x\.sale_id\]/.test(body),
    'an invoiced installment is only done once its sale is paid');
  assert.ok(!/status===.invoiced.\)\.length/.test(body),
    'invoiced must not be counted as remaining forever');
});

test('escJs makes an apostrophe safe inside an onclick', () => {
  const src = /const escJs = ([\s\S]*?);\r?\nconst escAttr/.exec(html);
  assert.ok(src, 'escJs not found');
  const escJs = eval('(' + src[1] + ')');
  const decoded = ("f('" + escJs("AMP'D") + "')")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");
  let got = null;
  eval("(function(){ function f(x){ got = x; } " + decoded + " })()");
  assert.strictEqual(got, "AMP'D",
    'the button must fire and receive the exact program name');
});

test('the blackout scope toggles survive a sheet type switch', () => {
  const src = /function calSetType\(t\)\{([\s\S]*?)\n\}/.exec(html);
  assert.ok(src, 'calSetType not found');
  assert.ok(/cs-bo-/.test(src[1]),
    'a partial closure must not silently become a full one');
});

test('membership edits are attributed to the signed-in staff email, never a placeholder', () => {
  assert.ok(!/\bcurrentEmail\b/.test(html), 'currentEmail was never defined and must not be referenced');
  ['memEditSave', 'memSchedSave', 'memSchedWaive', 'memSchedInvoice'].forEach((fn) => {
    const m = new RegExp('async function ' + fn + '\\([\\s\\S]*?\\n\\}').exec(html);
    assert.ok(m, fn + ' not found');
    assert.ok(/await currentStaffEmail\(\)/.test(m[0]), fn + ' must take the staff email from the session');
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
