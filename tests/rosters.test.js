/* ============================================================================
 * Class rosters
 * ----------------------------------------------------------------------------
 *     node tests/rosters.test.js
 *
 * A roster is not a table. It is an ACTIVE enrollments row, which the check-in
 * screen reads to decide whose name comes up by itself on a class list.
 *
 * The rules worth pinning are the ones a future reader would get wrong:
 *   - being OFF a roster has never stopped him adding somebody to a class, and
 *     must not start. Trials and drop-ins depend on it.
 *   - unchecking ENDS the row, it does not delete it. Enrollments carry sale_id,
 *     so the row is part of the membership sale that created it.
 *   - enrollments is UNIQUE (student_id, program), so coming back to a roster
 *     has to revive the existing row rather than insert a second one.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');

function liftFn(name) {
  const m = new RegExp('\\n(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm').exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}
function liftConst(name) {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*').exec(html);
  if (!m) throw new Error('could not lift ' + name);
  return m[0];
}

const sandbox = { console, ROSTERS: null, prettyDate: (d) => String(d) };
vm.createContext(sandbox);
vm.runInContext([
  liftConst('escHtml'), liftConst('escAttr'), liftConst('escJs'),
  liftConst('ROSTER_PROGRAMS'), liftFn('rosterRow'), liftFn('rostersHtml'),
].join('\n'), sandbox);

const PROGRAMS = vm.runInContext('ROSTER_PROGRAMS', sandbox);

function draw(rows) {
  sandbox.ROSTERS = { contactId: 'c1', rows: rows };
  return vm.runInContext('rostersHtml()', sandbox);
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

/* ── the domain rules ────────────────────────────────────────────────── */

test('the card says a roster is not permission to attend', () => {
  // The single most important thing on this card. Without it, a future reader
  // sees checkboxes labelled "roster" and assumes unchecking bars somebody
  // from class, which is not how the studio works.
  const out = draw([]);
  assert.ok(/not permission to attend/i.test(out), 'the card does not say what a roster is not');
  assert.ok(/added to any class at check-in/i.test(out), 'it does not say drop-ins still work');
});

test('taking somebody off a roster ends the row, it never deletes it', () => {
  const fn = liftFn('rosterToggle');
  assert.ok(!/\.delete\(\)/.test(fn), 'the toggle deletes an enrollment');
  assert.ok(/status\s*:\s*'ended'/.test(fn), 'it does not end the row');
  assert.ok(/ended_on/.test(fn), 'it does not stamp an end date');
});

test('coming back to a roster revives the row rather than inserting a second', () => {
  // enrollments is UNIQUE (student_id, program). A blind insert would throw.
  const fn = liftFn('rosterToggle');
  const insertAt = fn.indexOf('.insert(');
  const elseIf = fn.indexOf('} else if(r){');
  assert.ok(elseIf > -1, 'there is no revive branch at all');
  assert.ok(elseIf < insertAt, 'insert is reached before the existing row is checked');
  assert.ok(/status\s*:\s*'active',\s*ended_on:\s*null/.test(fn), 'reviving does not clear the end date');
});

test('the toggle does not touch the drop-in set', () => {
  // ATT_EXTRA is how somebody gets into a class without being enrolled.
  assert.ok(!/ATT_EXTRA/.test(liftFn('rosterToggle')), 'roster editing reaches into drop-ins');
});

test('changing a roster invalidates the check-in cache', () => {
  // attLoadData caches enrollments on first load, so without this a roster
  // changed at the desk would not show up at class until a page reload.
  assert.ok(/ATT_LOADED\s*=\s*false/.test(liftFn('rosterToggle')), 'the check-in cache is left stale');
});

/* ── the class-to-roster gate, checked against the public site ───────── */

test('a Jiu Jitsu class pulls the Jiu Jitsu roster, not Kickboxing', () => {
  // Thursday 7pm was a Kickboxing class that got retitled. prog_css stayed
  // prog-kick, which is correct and deliberate, so the CRM listed Kickboxing
  // students for a Jiu Jitsu class until it learned to read the label.
  const gate = vm.createContext({ console });
  // Declared without spaces round the =, so liftConst's pattern misses it.
  const decl = /\nconst ATT_PROG_GATE\s*=[^\n]*/.exec(html);
  assert.ok(decl, 'could not lift ATT_PROG_GATE');
  vm.runInContext(decl[0] + '\n' + liftFn('attProgramFor'), gate);
  const of = (prog_css, label) =>
    vm.runInContext('attProgramFor(' + JSON.stringify({ prog_css, label }) + ')', gate);
  assert.strictEqual(of('prog-kick', 'Jiu Jitsu'), 'Jiu Jitsu');
  assert.strictEqual(of('prog-kick', 'Jiu-Jitsu (BJJ)'), 'Jiu Jitsu');
  assert.strictEqual(of('prog-kick', 'Kickboxing'), 'Kickboxing');
  assert.strictEqual(of('prog-kick', ''), 'Kickboxing', 'an unlabelled prog-kick class must stay Kickboxing');
  assert.strictEqual(of('prog-cubs', 'Little Kickers'), 'Cubs');
});

test('the CRM splits prog-kick exactly the way the public site does', () => {
  // The website has bucketed the schedule this way all along. If the two ever
  // disagree, the public page advertises one class and attendance takes the
  // register for another, which is how this bug existed in the first place.
  const fnPath = path.join(__dirname, '..', '..', 'barestkd-site',
    'supabase', 'functions', 'trial-booking', 'index.ts');
  if (!fs.existsSync(fnPath)) { console.log('       (site function not present, skipped)'); return; }
  const site = fs.readFileSync(fnPath, 'utf8');
  const jj = /program:\s*"Jiu Jitsu"[\s\S]{0,200}?match:[^\n]*?prog_css === "([^"]+)"[^\n]*?\/([^/]+)\/i\.test/.exec(site);
  assert.ok(jj, 'could not find the site rule for Jiu Jitsu');
  const mine = liftFn('attProgramFor');
  assert.ok(mine.includes("'" + jj[1] + "'"), 'the CRM gates Jiu Jitsu on a different prog_css than the site');
  assert.ok(mine.includes('/(' + jj[2].replace(/^\(|\)$/g, '') + ')/i')
    || mine.includes('/' + jj[2] + '/i'),
    'the CRM matches a different label pattern than the site: site has ' + jj[2]);
});

/* ── what he sees ────────────────────────────────────────────────────── */

test('every program is offered, ticked or not', () => {
  const out = draw([]);
  PROGRAMS.forEach((p) => assert.ok(out.includes(p.replace(/'/g, '&#39;')) || out.includes(p),
    p + ' is missing from the list'));
  assert.strictEqual((out.match(/class="rost"/g) || []).length, PROGRAMS.length, 'wrong number of rows');
  assert.ok(!out.includes('rost on'), 'somebody on no rosters shows as being on one');
});

test('an active enrollment reads as ticked and an ended one does not', () => {
  const on = draw([{ id: 'e1', program: 'Juniors', status: 'active', started_on: '2026-01-05' }]);
  assert.ok(on.includes('rost on'), 'an active enrollment is not ticked');
  assert.strictEqual((on.match(/rost on/g) || []).length, 1, 'more than one program got ticked');
  const off = draw([{ id: 'e1', program: 'Juniors', status: 'ended', ended_on: '2026-06-01' }]);
  assert.ok(!off.includes('rost on'), 'an ended enrollment still reads as active');
  assert.ok(off.includes('ended '), 'it does not say when they came off');
});

test('a roster that came from a sale says so', () => {
  // The difference matters: one was bought, the other was ticked by hand.
  const sold = draw([{ id: 'e1', program: 'Cubs', status: 'active', sale_id: 's1', started_on: '2026-01-05' }]);
  assert.ok(sold.includes('from a membership'), 'a sold enrollment looks hand-added');
  const hand = draw([{ id: 'e2', program: 'Cubs', status: 'active', started_on: '2026-01-05' }]);
  assert.ok(!hand.includes('from a membership'), 'a hand-added one claims a membership');
  assert.ok(hand.includes('since '), 'it does not say when they went on');
});

test('a program nobody standardised on still shows up', () => {
  // Otherwise the only way to see it would be to untick it, and it would look
  // like it had never been there.
  const out = draw([{ id: 'e1', program: 'Weapons', status: 'active' }]);
  assert.ok(out.includes('Weapons'), 'an off-list program vanished from their own profile');
  assert.strictEqual((out.match(/class="rost on"/g) || []).length, 1, 'it is not ticked');
});

test('a failed read is not rendered as being on no rosters', () => {
  const fn = liftFn('loadProfileRosters');
  assert.ok(/Could not read their rosters/.test(fn), 'a failed read is silent about itself');
  const bad = fn.slice(fn.indexOf('if(error)'), fn.indexOf('ROSTERS ='));
  assert.ok(!/rostersHtml/.test(bad), 'it draws the checkbox list off data it does not have');
});

test('program names are escaped into the handler', () => {
  const out = draw([{ id: 'e1', program: "Bob's ' class", status: 'active' }]);
  assert.ok(!/onclick="rosterToggle\('Bob's/.test(out), 'a program name broke out of its handler');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
