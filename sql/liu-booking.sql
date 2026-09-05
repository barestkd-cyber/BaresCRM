-- Read-only: Joe Liu's trial booking, in studio time.
select tb.program, tb.class_label,
       to_char(tb.class_datetime at time zone 'America/Chicago',
               'Dy Mon DD, HH12:MI AM') as class_time_ct,
       tb.student_age, coalesce(tb.waiver_name,'(unsigned)') as waiver,
       tb.waiver_agreed,
       to_char(tb.created_at at time zone 'America/Chicago','Mon DD HH12:MI AM') as booked_at
  from public.trial_bookings tb
 where tb.contact_id = 'dad07997-cbc2-4cef-9fe5-225ea310aa79'
 order by tb.created_at desc;
