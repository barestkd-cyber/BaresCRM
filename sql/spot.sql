select first_name||' '||last_name as who, dob::text as dob, coalesce(gender,'-') as gender,
       coalesce(phone,'-') as phone, coalesce(address,'-') as address, rank
from contacts where spark_id in ('17669160','17183173','18165039');
