-- ===========================================================================
-- Registry of the LIVE public checkout pages, with the live switch.
-- ---------------------------------------------------------------------------
-- One row per page the website serves. The CRM (Checkout pages → Memberships)
-- lists these cards, shows what each page is selling right now by asking the
-- page's own function, and flips `live`. The page functions (program-checkout,
-- cubs-checkout, lk-checkout) read `live` and refuse new enrollments when it
-- is off; a sale already mid-payment still finalizes.
--
-- A MISSING row means live, so nothing disappears because it was not
-- registered yet. `fn` is the page's GET endpoint (function path, with the
-- ?p= slug where the function is shared), exactly what the page itself calls.
--
-- Run:  supabase db query --linked -f sql/checkout-pages.sql
-- ===========================================================================
create table if not exists public.checkout_pages (
  slug        text primary key,
  kind        text not null default 'enrollment' check (kind in ('enrollment','event','service')),
  program     text,                               -- pricing_plans.program / enrollments.program
  label       text not null,
  public_url  text not null,
  fn          text not null,                      -- e.g. 'program-checkout?p=juniors'
  live        boolean not null default true,
  sort_order  integer not null default 100,
  notes       text,
  updated_at  timestamptz default now()
);

alter table public.checkout_pages enable row level security;
drop policy if exists checkout_pages_staff_all on public.checkout_pages;
create policy checkout_pages_staff_all on public.checkout_pages
  for all using (is_staff()) with check (is_staff());

insert into public.checkout_pages (slug, kind, program, label, public_url, fn, sort_order) values
  ('cubs',           'enrollment', 'Cubs',           'Cubs',                       'https://www.barestkd.fit/cubs-checkout/',           'cubs-checkout',                  10),
  ('little-kickers', 'enrollment', 'Little Kickers', 'Little Kickers',             'https://www.barestkd.fit/little-kickers-checkout/', 'lk-checkout',                    20),
  ('juniors',        'enrollment', 'Juniors',        'Juniors Taekwondo',          'https://www.barestkd.fit/juniors-checkout/',        'program-checkout?p=juniors',     30),
  ('teens-adults',   'enrollment', 'Teens/Adults',   'Teens and Adults Taekwondo', 'https://www.barestkd.fit/teens-adults-checkout/',   'program-checkout?p=teens-adults',40),
  ('kickboxing',     'enrollment', 'Kickboxing',     'Kickboxing',                 'https://www.barestkd.fit/kickboxing-checkout/',     'program-checkout?p=kickboxing',  50),
  ('jiu-jitsu',      'enrollment', 'Jiu Jitsu',      'Jiu Jitsu',                  'https://www.barestkd.fit/jiu-jitsu-checkout/',      'program-checkout?p=jiu-jitsu',   60),
  ('ampd',           'enrollment', 'AMP''D',         'AMP''D',                     'https://www.barestkd.fit/ampd-checkout/',           'program-checkout?p=ampd',        70)
on conflict (slug) do nothing;
