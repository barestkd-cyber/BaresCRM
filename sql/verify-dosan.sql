select category, jsonb_pretty(content) as content
  from public.cycle_curriculum
 where scope='form' and form_name='Do-San' and category='kicks';
