-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- Locks down all public tables so they are only accessible
-- through the service role key (used by the dashboard server)
-- or via explicit policies for portal users (Supabase Auth).
--
-- Architecture:
--   - Admin dashboard → uses SUPABASE_SERVICE_KEY (bypasses RLS)
--   - Partner portal  → uses anon key + Supabase Auth session
--   - Shopify webhook → uses SUPABASE_SERVICE_KEY (bypasses RLS)
--
-- Safe to run multiple times.
-- ============================================================


-- ── Enable RLS on all tables ─────────────────────────────────────────────────

ALTER TABLE public.products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_aliases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners           ENABLE ROW LEVEL SECURITY;


-- ── Drop existing policies before recreating (idempotent) ────────────────────

DROP POLICY IF EXISTS "portal: read active products"    ON public.products;
DROP POLICY IF EXISTS "portal: read available variants" ON public.product_variants;
DROP POLICY IF EXISTS "portal: read own orders"         ON public.orders;
DROP POLICY IF EXISTS "portal: insert own orders"       ON public.orders;
DROP POLICY IF EXISTS "portal: read own order items"    ON public.order_items;
DROP POLICY IF EXISTS "portal: insert own order items"  ON public.order_items;
DROP POLICY IF EXISTS "portal: read own partner record" ON public.partners;


-- ── Portal user policies (authenticated via Supabase Auth) ───────────────────

-- Partners can read active products
CREATE POLICY "portal: read active products"
  ON public.products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Partners can read available variants of active products
CREATE POLICY "portal: read available variants"
  ON public.product_variants FOR SELECT
  TO authenticated
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM public.products
      WHERE id = product_variants.product_id AND is_active = true
    )
  );

-- Partners can read their own orders
CREATE POLICY "portal: read own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    partner_id = (
      SELECT id FROM public.partners
      WHERE email = auth.jwt() ->> 'email'
      LIMIT 1
    )
  );

-- Partners can insert new orders for themselves
CREATE POLICY "portal: insert own orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    partner_id = (
      SELECT id FROM public.partners
      WHERE email = auth.jwt() ->> 'email'
      LIMIT 1
    )
  );

-- Partners can read order items belonging to their orders
CREATE POLICY "portal: read own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.partners p ON p.id = o.partner_id
      WHERE o.id = order_items.order_id
        AND p.email = auth.jwt() ->> 'email'
    )
  );

-- Partners can insert order items for their own orders
CREATE POLICY "portal: insert own order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.partners p ON p.id = o.partner_id
      WHERE o.id = order_items.order_id
        AND p.email = auth.jwt() ->> 'email'
    )
  );

-- Partners can read their own partner record
CREATE POLICY "portal: read own partner record"
  ON public.partners FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- product_aliases: no portal policy — admin-only via service key


-- ── VERIFY ───────────────────────────────────────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'products', 'product_variants', 'product_aliases',
    'orders', 'order_items', 'partners'
  )
ORDER BY tablename;
