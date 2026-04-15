-- ============================================================
-- PRODUCT ALIASES
-- Maps alias products → canonical products for consolidated
-- roast scheduling. e.g. a partner's "House Blend" → "Day Tripper"
--
-- Safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_aliases (
  alias_product_id     BIGINT NOT NULL PRIMARY KEY
                       REFERENCES public.products(id) ON DELETE CASCADE,
  canonical_product_id BIGINT NOT NULL
                       REFERENCES public.products(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_alias CHECK (alias_product_id != canonical_product_id)
);


-- ── VERIFY ───────────────────────────────────────────────────────────────────
SELECT 'product_aliases table ready' AS status;
