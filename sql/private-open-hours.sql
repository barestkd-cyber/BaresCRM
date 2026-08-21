-- Owner, 2026-08-20: "I said all open hours before classes start. so if im
-- open at 230 on wednesday then lets start there right?"
-- Opening time is per DAY, not one weekday value. Same editable format as the
-- standing blocked slots. A day left off falls back to the old default, so a
-- typo shortens the list rather than closing the studio.
alter table public.settings
  add column if not exists private_open_hours text not null
    default 'Mon 3:00 PM, Tue 3:00 PM, Wed 3:00 PM, Thu 3:00 PM, Sat 8:30 AM';

select private_open_hours, private_blocked_slots from public.settings limit 1;
