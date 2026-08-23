/* ============================================================================
 * Guardians as people
 * ----------------------------------------------------------------------------
 *     node tests/guardians.test.js
 *
 * A guardian is one person referenced by each child, not a copy per child.
 * These pin the parts of that which are easy to break by accident: the shape
 * the loader builds, the household sharing being LIVE rather than copied, and
 * the search saying WHY a student matched.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// index.html is CRLF; normalising once here keeps every pattern below from
// having to know that.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');
let passed = 0;
function test(name, run) {
  try { run(); console.log('  ok   ' + name); passed++; }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + (e && e.message)); process.exitCode = 1; }
}
/** The body of a named function, up to the first line that closes at column 0. */
function body(name) {
  const re = new RegExp('function ' + name + '\\([^)]*\\)\\{\\n([\\s\\S]*?)\\n\\}');
  const m = re.exec(html);
  assert.ok(m, name + ' not found');
  return m[1];
}

test('the loader reads a guardian as a person, not a row per child', () => {
  assert.ok(/student_guardians'\)\s*\n\s*\.select\('student_id,label,guardian_id,guardians\(/.test(html),
    'loadMembers must join through guardians');
  assert.ok(/guardian_emails\(id,email,always_copy\)/.test(html),
    'every address the person answers to must come along');
  // The old four-slot array would silently mis-render once the shape changed.
  assert.ok(!/\.push\(\[g\.email \|\| '', g\.label/.test(html),
    "the old [email,label,name,phone] array shape is gone");
});

test('household sharing is live, not copied at merge time', () => {
  const b = body('profGuardiansFor');
  assert.ok(/householdOf\(/.test(b), 'it must consult the household');
  assert.ok(/seen\.has\(g\.id\)/.test(b), 'the same person must not appear twice');
  // Copying at merge time leaves a guardian behind when a child is pulled out
  // of a household, and never reaches siblings added later. Nothing may write.
  assert.ok(!/\.insert\(|\.update\(/.test(b), 'sharing must not write anything');
});

test('a borrowed guardian is marked as borrowed', () => {
  assert.ok(/borrowed: borrowed/.test(body('profGuardiansFor')), 'the flag must be carried');
  assert.ok(/borrowed[\s\S]{0,80}household/.test(body('profDrawGuardians')),
    'and shown, or a parent appears on a profile with no explanation');
});

test('an unreadable guardian list never reads as "there are none"', () => {
  const b = body('profDrawGuardians');
  const guard = b.indexOf('GUARDIANS_READ_OK');
  const none = b.indexOf('No guardian on file');
  assert.ok(guard > -1, 'the read must be checked');
  assert.ok(none === -1 || guard < none, 'the failure case must be handled first');
});

test('searching a guardian finds the students, and says which guardian', () => {
  const why = body('memberMatchWhy');
  assert.ok(/g\.name/.test(why) && /e\.email/.test(why), 'name and address both searchable');
  assert.ok(/return hit \|\| null/.test(why), 'it must hand back WHO matched');
  // Two Allens under a search for Carlton, with no reason shown, is
  // indistinguishable from a bug.
  assert.ok(/memberMatchWhy\(m, q\)/.test(body('renderList')), 'the row must show why it matched');
});

test('an address cannot be given to two guardians silently', () => {
  const b = body('gEditSave');
  assert.ok(/23505/.test(b), 'the unique violation must be handled');
  assert.ok(/already on another guardian/.test(b), 'and explained rather than swallowed');
  assert.ok(/is in there twice/.test(b), 'the same address twice on one person is refused');
});

test('editing a guardian says it changes every child', () => {
  const b = body('gEditRender');
  assert.ok(/changes this person everywhere/.test(b),
    'editing one row silently changing five profiles is the surprise worth preventing');
  assert.ok(/Guardian of/.test(b), 'whose parent this is must be visible while naming them');
});

console.log('\n' + passed + ' passed');
