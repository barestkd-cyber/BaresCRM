-- Which scheduled classes exist, and what belt range each one gates on.
select day, "time", label, belt, prog_css
  from schedule_template
 order by day, "time";
