// Who an automatic receipt goes to. Pure logic, no I/O, importable by BOTH
// the Deno function (send-receipt) and the Node test suite - which is the
// point: on 2026-08-24 three families paid $309.88 and nobody was emailed,
// and not one automated test could have caught it because this logic lived
// inline in an untested Edge Function.
//
// The rules (owner rulings, 2026-08-25, recorded in ECOSYSTEM 16.6h):
//   - An EXPLICIT list (the CRM's Email button) is used verbatim.
//   - Else the address typed at checkout (payer_email) wins outright
//     ("how confusing to pay with one email and get a receipt at another"),
//     PLUS every guardian flagged always-copy ("always copy can just stay on").
//   - Else - nothing typed, a desk sale - the family's on-file list stands in:
//     their own address, else the household primary, plus always-copies.
//   - Nobody at all: skip, with a reason the caller can alarm on.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveRecipients({ explicit = [], payerEmail = "", sendList = [], hasBuyer = false }) {
  const to = [];
  const push = (addr) => {
    const a = String(addr ?? "").trim().toLowerCase();
    if (a && EMAIL_RE.test(a) && !to.includes(a)) to.push(a);
  };

  const cleanExplicit = (explicit ?? []).map((a) => String(a ?? "").trim().toLowerCase())
    .filter((a) => a && EMAIL_RE.test(a));
  if (cleanExplicit.length) {
    for (const a of cleanExplicit) push(a);
    return { to, skipped: null };
  }

  push(payerEmail);
  const typedWon = to.length > 0;

  for (const row of sendList ?? []) {
    if (typedWon && String(row?.why ?? "") !== "always copy") continue;
    push(row?.email);
  }

  if (!to.length) {
    return {
      to,
      skipped: hasBuyer
        ? "nobody on file to email"
        : "walk-in sale with no checkout email, nobody to email",
    };
  }
  return { to, skipped: null };
}
