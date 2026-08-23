select count(*) as contacts,
       count(spark_id) as have_spark_id,
       count(dob) as have_dob,
       count(gender) as have_gender,
       count(phone) as have_phone,
       count(email) as have_email
from contacts;
