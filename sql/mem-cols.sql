select column_name || '  ' || data_type || coalesce('  default ' || column_default, '') as col
  from information_schema.columns
 where table_schema = 'public' and table_name = 'memberships'
 order by ordinal_position;
