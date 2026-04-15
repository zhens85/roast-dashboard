-- ============================================================
-- COMPLETE RLS RESET
-- Drops all existing portal policies and rebuilds them cleanly.
-- Run this to fully replace 11_enable_rls.sql and 12_rls_fix.sql.
-- ============================================================

-- ── Enable RLS on all tables ─────────────────────────────────────────────────
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_tiers    ENABLE ROW LEVEL SECURITY;

-- ── Drop all existing policies ───────────────────────────────────────────────
DROP POLICY IF EXISTS "portal: read active products"    ON public.products;
DROP POLICY IF EXISTS "portal: read available variants" ON public.product_variants;
DROP POLICY IF EXISTS "portal: read own orders"         ON public.orders;
DROP POLICY IF EXISTS "portal: insert own orders"       ON public.orders;
DROP POLICY IF EXISTS "portal: read own order items"    ON public.order_items;
DROP POLICY IF EXISTS "portal: insert own order items"  ON public.order_items;
DROP POLICY IF EXISTS "portal: read own partner record" ON public.partners;
DROP POLICY IF EXISTS "portal: read partner tiers"      ON public.partner_tiers;

-- ── products — authenticated users can read active products ──────────────────
CREATE POLICY "portal: read active products"
  ON public.products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ── product_variants — authenticated users can read available variants ────────
CREATE POLICY "portal: read available variants"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (is_available = true);

-- ── partner_tiers — any authenticated user can read all tiers ────────────────
CREATE POLICY "portal: read partner tiers"
  ON public.partner_tiers FOR SELECT
  TO authenticated
  USING (true);

-- ── partners — each partner can only read their own record ───────────────────
-- partners.id is the Supabase Auth UID (UUID), matching auth.uid()
CREATE POLICY "portal: read own partner record"
  ON public.partners FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ── orders — partners can read and insert their own orders ───────────────────
CREATE POLICY "portal: read own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (partner_id = auth.uid());

CREATE POLICY "portal: insert own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (partner_id = auth.uid());

-- ── order_items — partners can read and insert items on their own orders ─────
CREATE POLICY "portal: read own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
        AND partner_id = auth.uid()
    )
  );

CREATE POLICY "portal: insert own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_items.order_id
        AND partner_id = auth.uid()
    )
  );

-- product_aliases: no portal policy — admin-only via service key


-- ── VERIFY: show all policies ─────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
