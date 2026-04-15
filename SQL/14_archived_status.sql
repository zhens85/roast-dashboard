-- ============================================================
-- ADD 'archived' ORDER STATUS
-- Extends the orders status check constraint to allow archiving.
-- ============================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'archived'));

SELECT 'orders_status_check updated' AS status;
