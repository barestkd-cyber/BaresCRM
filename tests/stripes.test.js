/* ============================================================================
 * Stripes on the profile
 * ----------------------------------------------------------------------------
 *     node tests/stripes.test.js
 *
 * The CRM and class plan write the SAME rows in the same table. That is the
 * point of the feature and also the only thing about it that can quietly go
 * wrong: if the stripe ids drift apart, both apps keep working, both look
 * right, and a stripe logged at the desk simply never appears in class.
 *
 * So this suite loads the real shared belt catalogue and the real class plan,
 * and checks the CRM against both rather than against a fixture. It also runs
 * the render, because the last profile bug was a crash that every
 * string-checking test in this repo sailed straight past.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LIVE = path.join(ROOT, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r/g, '');
const beltsSrc = fs.readFileSync(path.join(LIVE, 'portal', 'shared', 'belts.js'), 'utf8');
const classplan = fs.readFileSync(path.join(LIVE, 'classplan', 'index.html'), 'utf8').replace(/\r/g, '');

const BELTS = new Function('window', beltsSrc + '; return BELTS;')({});

function liftFn(name) {
  const re = new RegExp('\\n(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}
function liftConst(name) {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*').exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}

const sandbox = {
  console, window: { BELTS: BELTS }, STRIPES: null,
  document: { getElementById: () => null, querySelectorAll: () => [] },
};
vm.createContext(sandbox);
vm.runInContext([
  liftConst('escHtml'), liftConst('escAttr'), liftConst('escJs'),
  liftFn('stripesForRank'), liftFn('stripesHtml'),
].join('\n'), sandbox);

/* `earned` is a Map of stripe key -> source since 2026-09-02: a bare Set
 * could not tell an instructor's own stripe from one a family logged at home
 * and is still waiting to be verified. Callers may pass plain ids (treated as
 * staff-logged) or [id, source] pairs. */
function draw(rank, earnedIds) {
  const asMap = (list) => new Map((list || []).map(x => Array.isArray(x) ? x : [x, 'staff']));
  sandbox.STRIPES = { contactId: 'c1', rank: rank, earned: earnedIds === null ? null : asMap(earnedIds) };
  return vm.runInContext('stripesHtml()', sandbox);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* ── the contract with class plan ────────────────────────────────────── */

test('the CRM offers exactly the stripes the catalogue lists, for every belt', () => {
  BELTS.forEach((b) => {
    const set = vm.runInContext('stripesForRank(' + JSON.stringify(b.name) + ')', sandbox);
    assert.ok(set, b.name + ' resolved to nothing');
    const want = (b.stripes.black || []).length + (b.stripes.colored || []).length;
    assert.strictEqual(set.left.length + set.right.length, want, b.name + ' offers the wrong number');
  });
});

test('every id the CRM would write is the catalogue id class plan writes', () => {
  // The two apps agree by using the same key, not by coincidence. If the CRM
  // ever derived or prefixed an id, stripes would split into two sets that
  // neither screen could see the whole of.
  BELTS.forEach((b) => {
    const set = vm.runInContext('stripesForRank(' + JSON.stringify(b.name) + ')', sandbox);
    const mine = set.left.concat(set.right).map((st) => st.id);
    const theirs = (b.stripes.black || []).concat(b.stripes.colored || []).map((st) => st.id);
    assert.deepStrictEqual(mine, theirs, b.name + ' disagrees with the catalogue');
    assert.ok(mine.every(Boolean), b.name + ' has a stripe with no id');
  });
});

test('the row class plan writes and the row the CRM writes have the same columns', () => {
  const theirs = /student_stripes'\)\.insert\(\{([^}]*)\}/.exec(classplan);
  const mine = /student_stripes'\)\.insert\(\{([\s\S]*?)\}\)/.exec(html);
  assert.ok(theirs && mine, 'could not find one of the two inserts');
  const cols = (src) => src.replace(/\s+/g, ' ').match(/(\w+)\s*:/g).map((c) => c.replace(/\s*:/, '')).sort();
  assert.deepStrictEqual(cols(mine[1]), cols(theirs[1]), 'the two apps write different columns');
});

test('both apps scope a delete by student, belt AND stripe', () => {
  // Without the belt in the where-clause, removing a stripe at one rank would
  // remove the same-named stripe at every rank the student has ever held.
  const del = /student_stripes'\)\.delete\(\)([\s\S]{0,220})/.exec(html);
  assert.ok(del, 'no delete found');
  ['student_id', 'belt', 'stripe_key'].forEach((c) =>
    assert.ok(del[1].includes(c), 'the delete does not filter on ' + c));
});

/* ── what he actually sees ───────────────────────────────────────────── */

test('a belt renders its diagram and a panel per stripe', () => {
  const out = draw('Orange Belt', []);
  const b = BELTS.find((x) => x.name === 'Orange Belt');
  const n = b.stripes.black.length + b.stripes.colored.length;
  assert.ok(out.includes('stbelt'), 'no belt drawn');
  assert.strictEqual((out.match(/class="stbelt-stripe"/g) || []).length, n, 'wrong slot count');
  assert.strictEqual((out.match(/class="stpanel"/g) || []).length, n, 'wrong panel count');
  assert.ok(out.includes('0 of ' + n), 'the count is wrong');
});

test('an earned stripe reads as earned and an unearned one does not', () => {
  const b = BELTS.find((x) => x.name === 'Orange Belt');
  const first = b.stripes.black[0].id;
  const none = draw('Orange Belt', []);
  assert.ok(!none.includes('stcheck on'), 'nothing is earned, yet something is ticked');
  assert.ok(none.includes('Log this stripe'), 'no way to log it');
  const one = draw('Orange Belt', [first]);
  assert.ok(one.includes('stcheck on'), 'an earned stripe is not ticked');
  assert.ok(one.includes('Earned, tap to remove'), 'no way to undo it');
  assert.ok(one.includes('1 of '), 'the count did not move');
});

test('a senior belt is drawn with its black band', () => {
  assert.ok(draw('Senior Green Belt', []).includes('linear-gradient'), 'senior belt drawn flat');
  assert.ok(!draw('Green Belt', []).includes('linear-gradient'), 'a plain belt got a band');
});

test('a Cub grade says so instead of drawing an empty belt', () => {
  // 17 people are on Cub grades the shared catalogue has never carried. A belt
  // with no stripes on it would read as "this student has earned nothing".
  const out = draw('Cub Orange Belt', []);
  assert.ok(!out.includes('stbelt-stripe'), 'a rank we have no list for drew a belt anyway');
  assert.ok(/Cub grades are not in the shared belt catalogue/.test(out), 'it does not say why');
});

test('a failed read is stated, not rendered as a student with no stripes', () => {
  const out = draw('Orange Belt', null);
  assert.ok(/could not be read/.test(out), 'a failed read is silent');
  assert.ok(/not a statement that they have none/.test(out), 'it lets the blank speak for us');
  assert.ok(!out.includes('stbelt-stripe'), 'it drew a belt off data it does not have');
});

test('no rank at all renders nothing rather than throwing', () => {
  assert.strictEqual(draw('', []), '');
  sandbox.STRIPES = null;
  assert.strictEqual(vm.runInContext('stripesHtml()', sandbox), '');
});

test('labels and ids are escaped on the way into the markup', () => {
  const evil = { name: 'Test Belt', color: '#123456', stripes: {
    black: [{ id: "x'-->", label: '<img src=x onerror=alert(1)>"', details: [] }], colored: [] } };
  sandbox.window.BELTS = BELTS.concat([evil]);
  const out = draw('Test Belt', []);
  sandbox.window.BELTS = BELTS;
  assert.ok(!out.includes('<img src=x'), 'a label reached the page as markup');
  assert.ok(!/onclick="stripePanel\('x'/.test(out), 'an id broke out of its handler');
});

test('a stripe a family logged shows as pending, with a way to verify it', () => {
  // The whole point of the source column: Race must be able to see at a
  // glance which stripes are somebody's claim and which are his own record.
  const b = BELTS.find((x) => x.name === 'Orange Belt');
  const first = b.stripes.black[0].id;
  const out = draw('Orange Belt', [[first, 'family']]);
  assert.ok(out.includes('Verify this stripe'), 'no way to confirm a family log');
  assert.ok(out.includes('Logged at home'), 'the panel does not say where it came from');
  assert.ok(out.includes('#B88A00'), 'a pending stripe is not marked amber');
  assert.ok(out.includes('Remove it'), 'no way to reject a wrong claim');
});

test('a staff stripe offers no Verify button, because there is nothing to confirm', () => {
  const b = BELTS.find((x) => x.name === 'Orange Belt');
  const first = b.stripes.black[0].id;
  const staff = draw('Orange Belt', [[first, 'staff']]);
  assert.ok(!staff.includes('Verify this stripe'), 'offered to verify its own record');
  assert.ok(staff.includes('Earned, tap to remove'), 'a staff stripe lost its remove action');
  const verified = draw('Orange Belt', [[first, 'verified']]);
  assert.ok(!verified.includes('Verify this stripe'), 'offered to verify an already verified stripe');
  assert.ok(verified.includes('stcheck on'), 'a verified stripe does not read as earned');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
