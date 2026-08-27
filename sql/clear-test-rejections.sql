-- Remove my own test rows. One used a real family's names (Castagnola) in a
-- live alerting system while that family is mid-enrollment - a fake failure
-- under a real name, which reads as a real event. Use obvious junk next time.
delete from card_rejections
 where code in ('self_test','incomplete_number')
   and (page = 'selftest'
        or (payer_name = 'Laura Castagnola' and phone = '9035551234'));

select count(*) as rows_left,
       coalesce(string_agg(coalesce(payer_name,'(no name)')||' / '||coalesce(page,'-'),', '),'none') as remaining
  from card_rejections;
