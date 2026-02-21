-- Migration: Add ShipStation tracking columns to orders table
-- Run this in the Supabase SQL Editor.
--
-- These columns are populated automatically by the ShipStation Custom Store
-- webhook endpoint (POST /api/shipstation/orders?action=shipnotify) when
-- ShipStation creates a shipping label and marks the order as shipped.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number  TEXT,
  ADD COLUMN IF NOT EXISTS carrier          TEXT,
  ADD COLUMN IF NOT EXISTS shipping_service TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at       TIMESTAMPTZ;

-- Index for looking up shipped orders by tracking number (optional but useful)
CREATE INDEX IF NOT EXISTS orders_tracking_number_idx
  ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;

COMMENT ON COLUMN public.orders.tracking_number  IS 'Shipping tracking number set by ShipStation on shipnotify';
COMMENT ON COLUMN public.orders.carrier          IS 'Carrier name (USPS, UPS, FedEx, etc.) from ShipStation';
COMMENT ON COLUMN public.orders.shipping_service IS 'Shipping service level from ShipStation (e.g. Priority Mail)';
COMMENT ON COLUMN public.orders.shipped_at       IS 'Timestamp when ShipStation confirmed the order was shipped';
