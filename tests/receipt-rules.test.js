/* ============================================================================
 * Who an automatic receipt goes to
 * ----------------------------------------------------------------------------
 *     node tests/receipt-rules.test.js
 *
 * WHY THIS EXISTS. On 2026-08-24 three testing families paid $309.88 and
 * NOBODY was emailed - not the families, not the owner, whose notification
 * rides the same send. The resolution logic lived inline in an Edge Function,
 * where no test in this repo could reach it, so the first test run was
 * production, with real money, found by the owner at the nightly report.
 *
 * The logic now lives in supabase/functions/_shared/recipients.mjs - pure,
 * no I/O - imported by the Deno function AND by this Node suite. Same file,
 * byte for byte. If the rules drift, this fails before a parent pays.
 *
 * The rules are owner rulings (2026-08-25, ECOSYSTEM 16.6h):
 *   explicit list (the CRM Email button) -> used verbatim
 *   typed-at-checkout address -> wins outright, plus always-copy guardians
 *   nothing typed (a desk sale)  -> the family's on-file list stands in
 *   nobody at all -> skip, with a reason the skip-alarm can act on
 * ========================================================================== */
'use strict';
const path = require('path');
const assert = require('assert');
const { pathToFileURL } = require('url');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}

(async () => {
  const mod = await import(pathToFileURL(
    path.join(__dirname, '..', 'supabase', 'functions', '_shared', 'recipients.mjs')).href);
  const R = mod.resolveRecipients;

  const FAMILY = [
    { email: 'kid.own@family.com', why: 'own' },
    { email: 'primary.mom@family.com', why: 'primary' },
    { email: 'copy.dad@family.com', why: 'always copy' },
  ];

  test('the typed address wins outright, and always-copy rides along', () => {
    // The owner's two rulings, one minute apart. own/primary must NOT ride.
    const r = R({ payerEmail: 'Typed@Stripe.com', sendList: FAMILY, hasBuyer: true });
    assert.deepStrictEqual(r.to, ['typed@stripe.com', 'copy.dad@family.com']);
    assert.strictEqual(r.skipped, null);
  });

  test('a desk sale (nothing typed) falls back to the whole on-file list', () => {
    const r = R({ payerEmail: '', sendList: FAMILY, hasBuyer: true });
    assert.deepStrictEqual(r.to,
      ['kid.own@family.com', 'primary.mom@family.com', 'copy.dad@family.com']);
  });

  test('typed matching an on-file address does not double-send', () => {
    const r = R({ payerEmail: 'COPY.DAD@family.com', sendList: FAMILY, hasBuyer: true });
    assert.deepStrictEqual(r.to, ['copy.dad@family.com']);
  });

  test('an explicit list from the Email button is used verbatim', () => {
    const r = R({ explicit: ['Race@Choice.com', 'bad email', 'race@choice.com'],
      payerEmail: 'typed@stripe.com', sendList: FAMILY, hasBuyer: true });
    // deduped, invalid dropped, and neither typed nor family added on top
    assert.deepStrictEqual(r.to, ['race@choice.com']);
  });

  test('MONDAY REGRESSION: typed address present, no buyer, family unknown', () => {
    // The exact shape of the three 2026-08-24 sales after the payer_email
    // backfill: a typed address and nothing else. Must send, never skip.
    const r = R({ payerEmail: 'tessawingfield8415@gmail.com', sendList: [], hasBuyer: false });
    assert.deepStrictEqual(r.to, ['tessawingfield8415@gmail.com']);
    assert.strictEqual(r.skipped, null);
  });

  test('MONDAY REGRESSION: the pre-fix shape (no typed read at all) skips loudly', () => {
    // What the old code effectively produced: no typed address surfaced, no
    // buyer. The skip REASON is the alarm hook; both spellings are pinned.
    const walkIn = R({ payerEmail: '', sendList: [], hasBuyer: false });
    assert.strictEqual(walkIn.skipped, 'walk-in sale with no checkout email, nobody to email');
    const onFile = R({ payerEmail: '', sendList: [], hasBuyer: true });
    assert.strictEqual(onFile.skipped, 'nobody on file to email');
    assert.deepStrictEqual(walkIn.to, []);
  });

  test('a garbage typed address does not block the family fallback', () => {
    // If checkout validation ever regresses and stores junk, the receipt must
    // not die with it: junk fails the email test, so the desk-sale path runs.
    const r = R({ payerEmail: 'not-an-email', sendList: FAMILY, hasBuyer: true });
    assert.deepStrictEqual(r.to,
      ['kid.own@family.com', 'primary.mom@family.com', 'copy.dad@family.com']);
  });

  test('unknown why-labels never sneak into a typed-wins send', () => {
    // The RPC contract is own/primary/always copy. A new label added later
    // must default to NOT riding along, or every send silently widens.
    const r = R({ payerEmail: 'typed@stripe.com',
      sendList: [{ email: 'new.thing@x.com', why: 'household' }], hasBuyer: true });
    assert.deepStrictEqual(r.to, ['typed@stripe.com']);
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
