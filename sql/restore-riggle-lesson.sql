-- Danica Riggle paid $36.32 for Hunter's private lesson (Wed Aug 26, 3:30 PM)
-- and the money landed, but the lesson was left 'canceled' and never reached
-- the wall calendar. Cause: the Stripe webhook marked the sale paid first, so
-- the checkout's finalize step skipped its whole "now it is real" block, and
-- the hold-expiry sweep later swept the still-pending row to canceled.
--
-- She paid. The lesson is real. This puts it back and puts it on the calendar.
update public.private_lessons
   set status = 'booked', notes = null
 where email = 'mdriggle1006@hotmail.com'
   and status = 'canceled';

insert into public.calendar_events (type, title, event_date, event_time, created_by)
select 'private',
       'Private · ' || coalesce(l.student_name, 'Private lesson'),
       (l.starts_at at time zone 'America/Chicago')::date,
       to_char(l.starts_at at time zone 'America/Chicago', 'FMHH12:MI AM'),
       'private-checkout@website'
  from public.private_lessons l
 where l.email = 'mdriggle1006@hotmail.com'
   and l.status = 'booked'
   and not exists (
     select 1 from public.calendar_events e
      where e.type = 'private'
        and e.event_date = (l.starts_at at time zone 'America/Chicago')::date
        and e.event_time = to_char(l.starts_at at time zone 'America/Chicago', 'FMHH12:MI AM')
   );

select l.student_name, l.status,
       to_char(l.starts_at at time zone 'America/Chicago', 'Dy Mon DD, FMHH12:MI AM') as lesson,
       (select count(*) from public.calendar_events e where e.type='private') as on_calendar
  from public.private_lessons l where l.email = 'mdriggle1006@hotmail.com';
