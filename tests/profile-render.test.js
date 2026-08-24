/* ============================================================================
 * The profile actually renders
 * ----------------------------------------------------------------------------
 *     node tests/profile-render.test.js
 *
 * WHY THIS EXISTS: on 2026-08-23 no active member's profile would open. The
 * list drew fine and the rows were clickable; renderProfile threw, so the view
 * simply never appeared. The cause was a `const` declared AFTER the line that
 * used it - not undefined, which would have rendered something wrong, but a
 * temporal-dead-zone ReferenceError, which rendered nothing at all.
 *
 * It only affected members WITH A BELT, because the line that used it lived in
 * the belt branch. Trials opened perfectly. That is the shape of bug a reader
 * will not spot and a green test suite will not catch, because every suite we
 * had checked the STRING renderProfile produces rather than whether it runs.
 *
 * So this one runs it, against the member shapes that differ: belted, trial,
 * with gear, without, in a household, alone.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');

function liftFn(name) {
  const re = new RegExp('\\n(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}
function liftConst(name) {
  const re = new RegExp('\\nconst ' + name + ' = [^\\n]*');
  const m = re.exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}

/* Enough of the app for renderProfile to run. Anything it only writes to is a
 * stub; anything it reads is real, so the test fails for real reasons. */
const els = {};
function el(id) {
  if (!els[id]) els[id] = { id, innerHTML: '', textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } };
  return els[id];
}
const sandbox = {
  console,
  BELT: { White: '#fff', Green: '#1FA463' },
  MEMBERS: [],
  currentMember: null,
  selectedId: null,
  PROF_ATT_WIN: 'cycle',
  PROF_TAB: 'invoices',
  GUARDIANS_READ_OK: true,
  HH_ROWS: [], HH_LINKS: [], HH_GUARDIANS: {}, HH_LOADED: true,
  PROF_INST: {},
  document: {
    getElementById: (id) => el(id),
    querySelector: () => ({ scrollTop: 0, innerHTML: '' }),
    querySelectorAll: () => [],
  },
  // Every async loader the render kicks off is somebody else's test.
  loadProfileCredits() {}, loadProfileAttendance() {}, loadProfileHousehold() {},
  loadProfileMemberships() {}, loadProfileRosters() {}, loadProfileNotes() {},
  loadProfileStats() {}, loadProfilePeople() {}, loadProfileMoney() {},
  loadProfileCards() {}, loadProfileRank() {}, profDrawGuardians() {},
  profBuildPanel() {}, profApplyTab() {},
  householdOf: () => null,
  money: (n) => '$' + Number(n || 0).toFixed(2),
  fmtDate: (d) => String(d || ''),
  fmtSince: (d) => String(d || ''),
  memberPlanLabel: () => '',
};
sandbox.$ = (sel) => el(String(sel).replace('#', ''));
vm.createContext(sandbox);
vm.runInContext([
  liftConst('escHtml'), liftConst('escAttr'), liftConst('escJs'), liftConst('initials'),
  // acc() is deliberately not lifted: it is a one-liner, so the lifter runs
  // on to the next line closing at column 0 and drags half the file with it.
  // Nothing calls it any more anyway - the More section it drew is gone.
  liftFn('kv'), liftFn('prettyDate'), liftFn('renderProfile'),
].join('\n'), sandbox);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

const base = {
  id: 'c1', first: 'Luther', last: 'Allen', segment: 'Active',
  belt: 'White', rank: 'White Belt', rankDate: '', program: 'TKD',
  phones: [], email: '', address: '', guardians: [],
  dob: '2016-10-03', age: 9, since: '', entered: '',
  beltSize: '', kickSize: '', app: false, source: 'spark',
  lessonCredits: 0, balanceCents: 0, visitLabel: '', lastVisit: null,
};
function render(over) {
  sandbox.currentMember = Object.assign({}, base, over || {});
  sandbox.MEMBERS = [sandbox.currentMember];
  sandbox.selectedId = sandbox.currentMember.id;
  vm.runInContext('renderProfile()', sandbox);
  return el('view-profile').innerHTML;
}

test('a belted member renders - the case that was broken', () => {
  // The whole bug: this threw, so no active member could be opened at all.
  const out = render({ belt: 'White', rank: 'White Belt' });
  assert.ok(out.length > 500, 'nothing rendered');
  assert.ok(out.includes('Luther'), 'the member is not on their own profile');
});

test('a member with no belt renders - the case that still worked', () => {
  const out = render({ belt: '', rank: '', segment: 'Trial' });
  assert.ok(out.length > 500, 'nothing rendered');
});

test('gear marks render whether the sizes are there or not', () => {
  const empty = render({ beltSize: '', kickSize: '' });
  assert.ok(/gearmark[^"]*empty/.test(empty), 'an empty size must still show, as the prompt to measure');
  const full = render({ beltSize: '2', kickSize: 'child S' });
  assert.ok(full.includes('child S'), 'a size that exists must show');
  assert.ok(!/gearmark empty/.test(full), 'a filled size must not read as empty');
});

test('the student app mark reflects both answers', () => {
  assert.ok(/appmark on/.test(render({ app: true })), 'on the app');
  assert.ok(!/appmark on/.test(render({ app: false })), 'not on the app');
});

test('the sections that were deleted stay deleted', () => {
  const out = render({ beltSize: '2' });
  // Each of these repeated something else on the page and was removed on
  // 2026-08-23. A revert would be silent without this.
  assert.ok(!out.includes('Training &amp; gear'), 'Training & gear is gone');
  assert.ok(!out.includes('>More<'), 'the More section is gone');
  assert.ok(!out.includes('Rank &amp; testing history'), 'the rank accordion is gone');
  assert.ok(out.includes('Rank &amp; testing'), 'but the rank TAB is there');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
