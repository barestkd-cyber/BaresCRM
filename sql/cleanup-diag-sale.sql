-- Remove the key-verification registration. Unpaid, no payment rows attached.
delete from public.testing_signups where sale_id = 'dafee7e0-3e33-47e9-a597-54aec13a5948';
delete from public.pos_sale_lines  where sale_id = 'dafee7e0-3e33-47e9-a597-54aec13a5948';
delete from public.pos_sales       where id      = 'dafee7e0-3e33-47e9-a597-54aec13a5948';
select (select count(*) from public.pos_sales) as sales_left;
