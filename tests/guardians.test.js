/* ============================================================================
 * Guardians as people
 * ----------------------------------------------------------------------------
 *     node tests/guardians.test.js
 *
 * A guardian is one person referenced by each child, not a copy per child.
 * These pin the parts of that which are easy to break by accident: the shape
 * the loader builds, the household sharing being LIVE rather than copied, the
 * search saying WHY a student matched, and one rule deciding who gets mail.
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// index.html is CRLF; normalising once here keeps every pattern below from
// having to know that.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/\r/g, '');
const receiptFn = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'functions', 'send-receipt', 'index.ts'), 'utf8').replace(/\r/g, '');

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
    'the old [email,label,name,phone] array shape is gone');
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

test('one rule decides who a receipt goes to, and both callers ask it', () => {
  // Two copies of a mail rule drift, and the drift is found by a customer.
  assert.ok(/contact_send_list/.test(receiptFn), 'the server must use the shared rule');
  assert.ok(!/select\("email"\)\.eq\("id", s\.buyer_contact_id\)/.test(receiptFn),
    'reading the buyer address straight off contacts is what misfiled Carlton');
  assert.ok(/contact_send_list/.test(html), 'and the CRM prefill must use it too');
});

test('recipient resolution goes through the shared, tested rulebook', () => {
  // Typed-leads and nobody-mailed-twice used to be pinned here against the
  // inline code. Since 2026-08-25 that logic lives in _shared/recipients.mjs,
  // imported byte-for-byte by BOTH the Deno function and
  // tests/receipt-rules.test.js, which pins those rules (and the Monday
  // regressions) directly. This test now holds the seam: the function must
  // actually route through the rulebook and feed it the shared family rule.
  assert.ok(/_shared\/recipients\.mjs/.test(receiptFn), 'send-receipt must import the rulebook');
  assert.ok(/resolveRecipients\(\{/.test(receiptFn), 'and resolve recipients through it');
  assert.ok(/contact_send_list/.test(receiptFn), 'feeding it the family send list');
});

test('a relationship is saved on the LINK, not on the person', () => {
  // Lindsay Tarry is Lee's Spouse AND Radford's Mom. One field on her own
  // record could only say one of those, and it was saying Spouse on both of
  // her children's profiles (owner, 2026-08-26). The relationship belongs to
  // the pair, so it lives on student_guardians.label.
  const save = body('gEditSave');
  assert.ok(/from\('student_guardians'\)[\s\S]*?label:\s*REL_PICK/.test(save),
    'the relationship is not written to the link');
  assert.ok(/\.eq\('student_id',\s*g\.backTo\)/.test(save),
    'the link write is not scoped to the profile it was opened from');
  // The person-level update must no longer carry relation, or tagging one
  // profile would rename her on every other.
  const personUpdate = save.slice(save.indexOf("from('guardians')"), save.indexOf('guardian save'));
  assert.ok(!/relation:/.test(personUpdate), 'the person record still takes the relationship');
});

test('the guardian list reads the relationship from the link first', () => {
  const map = html.slice(html.indexOf('const guardiansById'), html.indexOf('const guardiansById') + 900);
  assert.ok(/relation:\s*r\.label\s*\|\|\s*g\.relation/.test(map),
    'the per-link relationship does not win over the person-level one');
});

test('the primary contact is set by a tap, not a drag', () => {
  assert.ok(/gMakePrimary\(\)/.test(body('gEditRender')), 'there must be a button');
  assert.ok(!/draggable|dragstart|ondrop/i.test(html), 'no drag targets to miss on a phone');
});

test('tapping a guardian offers to reach them, not to edit them', () => {
  // The common act is ringing a parent; changing their details is rare. A row
  // whose tap opens an edit form makes the rare thing the easy one.
  const b = body('profDrawGuardians');
  assert.ok(/gSheetOpen\(/.test(b), 'the row opens the contact sheet');
  assert.ok(!/gEditOpen\(/.test(b), 'not the edit sheet');
  const sheet = html.slice(html.indexOf('async function gSheetOpen'));
  assert.ok(/href="tel:/.test(sheet), 'a tap-to-call target per phone');
  assert.ok(/href="mailto:/.test(sheet), 'a tap-to-email target per address');
  assert.ok(/Edit their details/.test(sheet), 'editing is behind a button');
});

test('the emptiest fact on the card is not the loudest thing on it', () => {
  assert.ok(!/Nothing of their own on file/.test(html),
    'the guardians below ARE the answer to that note');
});

console.log('\n' + passed + ' passed');
