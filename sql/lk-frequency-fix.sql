-- Little Kickers is ONE payment up front (owner, repeatedly).
--
-- memberships carries TWO columns for one idea:
--   billing_frequency  text    -- what charge-due actually reads; 'one_time'
--   frequency          enum    -- type billing_frequency, values ONLY (weekly, monthly)
--
-- The enum has no 'one_time' member, so a paid-in-full plan CANNOT be spelled
-- in `frequency` at all. It said 'monthly' on both LK rows purely because the
-- enum offered nothing truthful. Clearing it to NULL is the honest state: the
-- governing column says one_time, and the vestigial one says nothing rather
-- than something false that an importer might copy.
--
-- Scoped to rows whose GOVERNING column already reads one_time, so this can
-- only ever resolve a disagreement, never redefine a real recurring plan.
update memberships
   set frequency = null
 where billing_frequency = 'one_time'
   and frequency is not null
returning program, coalesce(frequency::text,'(cleared)') as freq, billing_frequency as bill_freq;
