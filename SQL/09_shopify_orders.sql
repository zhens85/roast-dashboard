-- ============================================================
-- SHOPIFY ORDERS MIGRATION
-- Adds fields needed to store orders imported from Shopify.
--
-- Safe to run multiple times — each statement checks before altering.
-- ============================================================

-- Allow orders without a partner (Shopify orders may not match any partner account)
ALTER TABLE public.orders
  ALTER COLUMN partner_id DROP NOT NULL;

-- Track where the order came from: 'portal' (default) or 'shopify'
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal'
  CHECK (source IN ('portal', 'shopify'));

-- Shopify order ID for idempotency (e.g. 'shopify_12345678')
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Unique index so we never import the same Shopify order twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_id
  ON public.orders(external_id)
  WHERE external_id IS NOT NULL;

-- Customer info for Shopify orders that don't match a partner account
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Shipping address stored as JSON (from Shopify shipping_address object)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_address JSONB;


-- ── VERIFY ───────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
ORDER BY ordinal_position;
