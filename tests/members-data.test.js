/* ============================================================================
 * Members list data
 * ----------------------------------------------------------------------------
 *     node tests/members-data.test.js
 *
 * The chips and columns on the Members list are fed from the ledger and the
 * memberships table, never from placeholder fields. These lift the pure
 * helpers straight out of index.html.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Brace-counted, so one-line helpers lift cleanly (a lazy "up to the next
// line-starting }" would swallow whatever object literal follows them).
function liftFn(name) {
  const re = new RegExp('\\n(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  let i = html.indexOf('{', m.index), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(m.index + 1, i + 1);
}
function liftConst(name) {
  const re = new RegExp('\\nconst ' + name + ' = [^\\n]*');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext([liftConst('escHtml'), liftConst('RISK_DAYS'), liftFn('isOverdue'), liftFn('isRisk'), liftFn('contactBalances'), liftFn('memberPlanLabel')].join('\n'), sandbox);
const run = (expr) => vm.runInContext(expr, sandbox);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + (e.message)); }
}

test('balance due is total minus payments per buyer, partials respected, walk-ins ignored', () => {
  sandbox.S = [
    { id: 's1', buyer_contact_id: 'a', total_cents: 8904 },
    { id: 's2', buyer_contact_id: 'a', total_cents: 2000 },
    { id: 's3', buyer_contact_id: null, total_cents: 5000 },
    { id: 's4', buyer_contact_id: 'b', total_cents: 1000 },
  ];
  sandbox.P = [{ sale_id: 's1', amount_cents: 4000 }, { sale_id: 's4', amount_cents: 1000 }];
  const owed = run('contactBalances(S, P)');
  assert.strictEqual(owed.a, 4904 + 2000, 'a owes the remainder of s1 plus all of s2');
  assert.strictEqual(owed.b, 0, 'a fully paid-but-still-unpaid-status invoice owes nothing');
  assert.strictEqual(owed[null], undefined, 'walk-in sales belong to nobody');
  assert.strictEqual(run('isOverdue({balanceCents: 1})'), true);
  assert.strictEqual(run('isOverdue({balanceCents: 0})'), false);
  assert.strictEqual(run('isOverdue({})'), false, 'no placeholder field, no balance');
});

test('an active member who has never checked in is at risk; an unknown last visit is not "fine"', () => {
  assert.strictEqual(run('isRisk({segment:"Active", daysSince: 9999})'), true, 'never attended = most at risk');
  assert.strictEqual(run('isRisk({segment:"Active", daysSince: 3})'), false);
  assert.strictEqual(run('isRisk({segment:"Active", daysSince: 14})'), true, 'RISK_DAYS is inclusive');
  assert.strictEqual(run('isRisk({segment:"Lead", daysSince: 9999})'), false, 'only active members are at risk');
  assert.ok(/contact_last_visit/.test(html), 'last visits come from the contact_last_visit view, not a bounded window');
  assert.ok(!/gte\('class_date',attYMD\(since\)\)/.test(html), 'the 90-day bounded read is gone');
});

test('the Plan column shows the real membership, program first, and counts extras', () => {
  assert.strictEqual(run('memberPlanLabel({memberships: []})'), '');
  assert.strictEqual(run('memberPlanLabel({memberships: [{program:"Juniors", plan:"Option C", status:"active"}]})'), 'Juniors · Option C');
  const two = run('memberPlanLabel({memberships: [{program:"Juniors", plan:"Option C", status:"active"},{program:"Kickboxing", plan:"Add-on", status:"active"}]})');
  assert.ok(/Juniors · Option C/.test(two) && /\+1/.test(two), 'second membership shown as +1');
  assert.strictEqual(run('memberPlanLabel({memberships: [{program:"Cubs", plan:"<b>x</b>", status:"ended"}]})'), '', 'ended memberships do not show');
  assert.ok(!/<b>/.test(run('memberPlanLabel({memberships: [{program:"<b>Cubs</b>", plan:"x", status:"active"}]})')), 'escaped');
});

test('the Testing chip and tile are gone until the Testing app owns eligibility', () => {
  const filters = /const FILTERS = \{[\s\S]*?\n\};/.exec(html);
  assert.ok(filters && !/testing/.test(filters[0]), 'no Testing chip in FILTERS');
  assert.ok(!/k:"testing"/.test(html), 'no Testing dashboard card');
  assert.ok(!/function isTesting/.test(html));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
