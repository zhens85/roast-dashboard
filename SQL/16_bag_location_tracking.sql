-- ============================================================
-- BAG LOCATION TRACKING
-- Splits bag counts across warehouse and roastery.
-- Transfers move bags without changing total_weight_lbs.
-- ============================================================

-- Add bag_count to transactions (number of bags moved on a transfer)
ALTER TABLE public.green_lot_transactions
  ADD COLUMN IF NOT EXISTS bag_count INTEGER;

-- Add per-location bag counts to lots
ALTER TABLE public.green_lots
  ADD COLUMN IF NOT EXISTS bags_at_warehouse INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.green_lots
  ADD COLUMN IF NOT EXISTS bags_at_roastery INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing lots assumed to be fully at the roastery
UPDATE public.green_lots
SET bags_at_roastery = bag_count
WHERE bags_at_roastery = 0 AND bags_at_warehouse = 0;

SELECT
  lot_number,
  bag_count,
  bags_at_warehouse,
  bags_at_roastery
FROM public.green_lots
ORDER BY created_at;
