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

test('program and plan are NOT editable', () => {
  // Changing either means a different contract, not an edit. The signed
  // agreement is about the program and the plan.
  const keys = MEM_FIELDS.map((f) => f.key);
  ['program', 'plan_code', 'plan_id'].forEach((k) =>
    assert.ok(!keys.includes(k), k + ' must not be editable from the profile'));
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

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
