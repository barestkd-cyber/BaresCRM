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
  loadProfileCards() {}, loadProfileRank() {}, loadProfileHistory() {}, loadProfileDocs() {}, profDrawGuardians() {},
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
  liftConst('escHtml'), liftConst('escAttr'), liftConst('escJs'), liftConst('initials'), liftConst('rankShort'),
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
  // Display only since 2026-08-26: one editor, deliberately opened, so a
  // pocket tap can never change a size. Nothing on the card writes data.
  assert.ok(!/gearEdit/.test(html), 'the gear marks are editable again');
  const full = render({ beltSize: '2', kickSize: 'child S' });
  assert.ok(full.includes('child S'), 'a size that exists must show');
  assert.ok(!/gearmark empty/.test(full), 'a filled size must not read as empty');
});

test('the marks stack uniform, shoe, phone, beside the dates', () => {
  // Owner, 2026-08-23: "stack the uniform first the shoe second and then the
  // phone third and that should be in the DOB and lead since section."
  const out = render({ belt: 'Green', rank: 'Green Belt', beltSize: '3', kickSize: 'child S' });
  assert.ok(out.includes('markcol'), 'the marks are not stacked');
  const uniform = out.indexOf('🥋'), shoe = out.indexOf('👟'), phone = out.indexOf('📱');
  assert.ok(uniform < shoe && shoe < phone, 'the marks are not in uniform, shoe, phone order');
  // Beside the dates, not under the name. Both live in the header, so position
  // relative to the facts grid is what actually says which block they are in.
  assert.ok(out.indexOf('phead-facts') < out.indexOf('markcol'), 'the marks are still above the facts grid');
  assert.ok(out.indexOf('markcol') < out.indexOf('Credits'), 'the marks are not in the credits column');
});

test('the derived belt line is gone and the rank is the tappable thing', () => {
  // m.belt is DERIVED from the rank, so "Senior Yellow Belt" was printing
  // "Yellow Belt" underneath itself. The colour dot moved into the chip.
  const out = render({ belt: 'Yellow', rank: 'Senior Yellow Belt', phase: 'TKD' });
  assert.ok(!out.includes('beltnow'), 'the duplicate belt line is still rendered');
  assert.ok(!out.includes('Yellow Belt</span>'), 'the derived belt name is still printed');
  assert.ok(out.includes('rankchip'), 'the rank is not a chip');
  assert.ok(out.includes('profShowRank()'), 'the rank chip does not go anywhere');
  assert.ok(out.includes('Senior Yellow Belt'), 'the real rank is not shown');
  assert.ok(out.includes('beltdot'), 'the belt colour cue was lost with the line');
  // The program sits centred ABOVE the chip, not run into it on one line.
  assert.ok(out.includes('rankprog'), 'the program fell off the subtitle');
  assert.ok(out.indexOf('rankprog') < out.indexOf('rankchip'), 'the program is not above the chip');
});

test('an adult reads Family and contacts, a minor reads Guardians', () => {
  // Age says adult; and a Spouse tag says adult even with NO DOB on file,
  // because that is exactly Lee: no birthday, a wife, and the wrong heading.
  const kid = render({ age: 9, guardians: [] });
  assert.ok(kid.includes('Guardians'), 'a minor lost the Guardians heading');
  assert.ok(!kid.includes('Family and contacts'), 'a minor reads as an adult');
  const byAge = render({ age: 41 });
  assert.ok(byAge.includes('Family and contacts'), 'an 18+ member still reads Guardians');
  const bySpouse = render({ age: 0, dob: '', guardians: [{ relation: 'Spouse', name: 'Lindsay' }] });
  assert.ok(bySpouse.includes('Family and contacts'),
    'a spouse-tagged member with no DOB still reads Guardians');
});

test('gender shows, filled or empty, like DOB and the gear sizes', () => {
  // Owner (household design pass): "may need gender on profile too for easy
  // data collection." 102 of 141 contacts have no value; the blank that
  // renders is the blank that gets filled.
  const has = render({ gender: 'Female' });
  assert.ok(has.includes('>Gender<'), 'no gender label');
  assert.ok(has.includes('>Female<'), 'the value is not shown');
  const not = render({ gender: '' });
  assert.ok(not.includes('>Gender<'), 'the label vanished with the value');
  assert.ok(not.includes('Add gender'), 'an empty gender is not offered as something to fill');
});

test('DOB shows even when there is no DOB', () => {
  // Owner, 2026-08-23: "if DOB field is empty it still needs to show up." A row
  // that disappears when empty is a question nobody ever gets asked.
  const has = render({ dob: '2016-10-03', age: 9 });
  assert.ok(has.includes('>DOB<'), 'the label is missing when there IS a dob');
  assert.ok(has.includes('(age 9)'), 'the age fell off');
  const not = render({ dob: '', age: 0 });
  assert.ok(not.includes('>DOB<'), 'the label vanished with the value');
  assert.ok(not.includes('Add date of birth'), 'the blank is not offered as something to fill');
  assert.ok(!not.includes('(age'), 'an age was invented for a member with no birthday');
});

test('the marks hold the same spot whether they are filled or empty', () => {
  // Owner, 2026-08-23: "whether filled in or empty they need to be in the same
  // spot." The column is right-positioned, so it needs a FIXED width; sized to
  // its content it slides left as soon as somebody's kick size is "9/10".
  const css = html.slice(html.indexOf('.markcol{'), html.indexOf('.markcol{') + 220);
  assert.ok(/width:\s*\d+px/.test(css), 'the marks column has no fixed width, so it will shift');
  assert.ok(/align-items:\s*flex-start/.test(css), 'the marks are not left-aligned inside the column');
});

test('the marks are beside the dates, not in the credits column', () => {
  // On a phone .phead-facts collapses to one column, so a second grid column
  // lands UNDER the dates. Owner caught exactly that: "you put this in the
  // credit section instead of right to the right of the date of birth
  // section." They have to share a cell to sit side by side at every width.
  const out = render({ belt: 'Green', rank: 'Green Belt', beltSize: '3' });
  const cell = out.indexOf('pf-datecell');
  assert.ok(cell > -1, 'the dates and marks are not sharing a cell');
  assert.ok(cell < out.indexOf('markcol'), 'the marks are outside the dates cell');
  assert.ok(out.indexOf('markcol') < out.indexOf('Credits'), 'the marks drifted into credits');
  // The cell must close before Credits opens, or they are siblings again.
  assert.ok(out.indexOf('markcol') < out.indexOf('>Credits<'), 'credits is inside the dates cell');
});

test('somebody with no rank gets no chip and no empty subtitle', () => {
  const out = render({ belt: '', rank: '', phase: '', segment: 'Trial' });
  assert.ok(!out.includes('rankchip'), 'a chip for a rank that does not exist');
  assert.ok(out.includes('>Trial<'), 'the subtitle fell back to nothing');
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

test('Documents is a real tab with a real section, not a stub', () => {
  const out = render({});
  assert.ok(out.includes("profSetTab('docs')"), 'the Documents tab is not clickable');
  assert.ok(!/Documents <span class="pact-chip">COMING SOON/.test(out), 'Documents reads as coming soon');
  assert.ok(out.includes('data-ptab="docs"'), 'there is no docs section to land on');
  assert.ok(out.includes('prof-docs'), 'the list has no container to render into');
});

test('medical concerns show on the top card only when there is one', () => {
  // Owner 2026-08-26. Silent for everybody else, so it never becomes furniture
  // to scroll past - which is what would make it missed on the one profile
  // where it matters.
  const none = render({ medical: '' });
  assert.ok(!none.includes('pmed'), 'an empty medical note still drew a block');
  const some = render({ medical: 'Peanut allergy, carries an epi-pen' });
  assert.ok(some.includes('pmed'), 'a real medical note did not show');
  assert.ok(some.includes('epi-pen'), 'the note itself is missing');
  assert.ok(some.indexOf('pmed') > some.indexOf('phead-facts'), 'it must sit inside the top card');
});

test('medical is escaped like every other field', () => {
  const out = render({ medical: '<script>x</script>' });
  assert.ok(!out.includes('<script>x'), 'a medical note broke out of its markup');
});

test('History is a real tab with a real section, not a stub', () => {
  // It shipped 2026-08-25 as the profile's one feed. A regression to the
  // COMING SOON stub would be silent without this.
  const out = render({});
  assert.ok(out.includes("profSetTab('history')"), 'the History tab is not clickable');
  assert.ok(!/History <span class="pact-chip">COMING SOON/.test(out), 'History reads as coming soon');
  assert.ok(out.includes('data-ptab="history"'), 'there is no history section to land on');
  assert.ok(out.includes('prof-history'), 'the feed has no container to render into');
});

/* ── the invoice list: family invoices are marked ────────────────────── */

test('an invoice covering two participants renders yellow; one does not', () => {
  // Owner, 2026-08-25: "highlighted yellow if it's attached to more than one
  // participant in that family." famN is the count of DISTINCT kids named on
  // the sale's lines; the buyer alone is not a family.
  vm.runInContext(liftFn('profRenderInvoices'), sandbox);
  sandbox.PROF_INV_F = 'all';
  sandbox.PROF_MONEY = [
    { id: 's1', date: '2026-08-24', total: 11359, paid: 11359, balance: 0,
      st: 'paid', statusRaw: 'paid', labels: 'Belt testing - Victoria + Madison', famN: 2 },
    { id: 's2', date: '2026-08-24', total: 5180, paid: 5180, balance: 0,
      st: 'paid', statusRaw: 'paid', labels: 'Belt testing - Elora', famN: 1 },
  ];
  els['prof-invoices'] = { id: 'prof-invoices', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } };
  vm.runInContext('profRenderInvoices()', sandbox);
  const out = els['prof-invoices'].innerHTML;
  assert.strictEqual((out.match(/class="fam"/g) || []).length, 1, 'exactly one row should be marked');
  assert.ok(/fam" title="Family invoice: covers 2 participants"/.test(out), 'the mark does not say why');
  assert.ok(out.indexOf('fam') < out.indexOf('Elora'), 'the wrong row got marked');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
