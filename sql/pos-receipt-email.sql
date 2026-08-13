-- ============================================================================
-- BaresTKD — emailed-receipt stamp columns (run once; safe to re-run)
-- ----------------------------------------------------------------------------
-- send-receipt stamps where and when a receipt/invoice email went out, so the
-- invoice view can show "Receipt sent to … at …". Sales that never emailed
-- one stay NULL.
-- ============================================================================

alter table public.pos_sales add column if not exists receipt_email   text;
alter table public.pos_sales add column if not exists receipt_sent_at timestamptz;

-- ROLLBACK (commented):
-- alter table public.pos_sales drop column if exists receipt_email;
-- alter table public.pos_sales drop column if exists receipt_sent_at;
