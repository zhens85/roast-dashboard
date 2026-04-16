-- ============================================================
-- GREEN INVENTORY
-- Tables: green_lots, green_lot_transactions, blend_recipes, blend_recipe_items
-- Run after 14_archived_status.sql
-- ============================================================

-- ── Sequence for lot_number generation ──────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS green_lot_number_seq START 1;

-- ── green_lots ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.green_lots (
  id                  BIGSERIAL PRIMARY KEY,
  lot_number          TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  origin              TEXT NOT NULL,
  producer            TEXT,
  harvest_year        TEXT,
  process             TEXT,
  location            TEXT NOT NULL DEFAULT 'Roastery',
  origin_warehouse    TEXT,
  bag_count           INTEGER NOT NULL DEFAULT 0,
  bag_weight_lbs      NUMERIC(8,2) NOT NULL,
  total_weight_lbs    NUMERIC(10,2) NOT NULL,
  initial_weight_lbs  NUMERIC(10,2) NOT NULL,
  price_per_lb        NUMERIC(8,4),
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate lot_number: PG-0001, PG-0002, …
CREATE OR REPLACE FUNCTION generate_green_lot_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lot_number := 'PG-' || LPAD(nextval('green_lot_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_green_lot_number ON public.green_lots;
CREATE TRIGGER trg_green_lot_number
  BEFORE INSERT ON public.green_lots
  FOR EACH ROW
  WHEN (NEW.lot_number IS NULL OR NEW.lot_number = '')
  EXECUTE FUNCTION generate_green_lot_number();

-- ── green_lot_transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.green_lot_transactions (
  id              BIGSERIAL PRIMARY KEY,
  green_lot_id    BIGINT NOT NULL REFERENCES public.green_lots(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('received', 'transferred', 'roasted', 'adjustment')),
  weight_lbs      NUMERIC(10,2) NOT NULL,
  location_from   TEXT,
  location_to     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_lot_transactions_lot_id
  ON public.green_lot_transactions(green_lot_id);

-- ── blend_recipes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blend_recipes (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL DEFAULT 1,
  is_current  BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blend_recipes_product_id
  ON public.blend_recipes(product_id);

-- ── blend_recipe_items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blend_recipe_items (
  id                BIGSERIAL PRIMARY KEY,
  blend_recipe_id   BIGINT NOT NULL REFERENCES public.blend_recipes(id) ON DELETE CASCADE,
  green_lot_id      BIGINT NOT NULL REFERENCES public.green_lots(id) ON DELETE RESTRICT,
  percentage        NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_blend_recipe_items_recipe_id
  ON public.blend_recipe_items(blend_recipe_id);

-- ── Enable RLS (service key only — no portal policies) ────────────────────────
ALTER TABLE public.green_lots              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.green_lot_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blend_recipes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blend_recipe_items      ENABLE ROW LEVEL SECURITY;

-- No portal-facing policies — all access goes through service key (API routes).
-- The service key bypasses RLS entirely.

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'green_lots', 'green_lot_transactions',
    'blend_recipes', 'blend_recipe_items'
  )
ORDER BY tablename, policyname;
