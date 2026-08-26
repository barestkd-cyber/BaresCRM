select jobname, schedule, left(command, 120) as command from cron.job order by jobname;
