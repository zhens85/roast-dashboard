-- ============================================================
-- RLS FIX — patch missing policies after 11_enable_rls.sql
--
-- Fixes:
--   1. partner_tiers was missing RLS + policy entirely
--   2. partners policy now matches by auth.uid() since the portal
--      queries partners by id = auth user id, not by email
-- ============================================================

-- ── Enable RLS on partner_tiers (was missing) ────────────────────────────────
ALTER TABLE public.partner_tiers ENABLE ROW LEVEL SECURITY;

-- ── Fix partners policy — match by auth UID not email ────────────────────────
DROP POLICY IF EXISTS "portal: read own partner record" ON public.partners;

CREATE POLICY "portal: read own partner record"
  ON public.partners FOR SELECT
  TO authenticated
  USING (id::text = auth.uid()::text);

-- ── Add partner_tiers policy — any authenticated user can read tiers ─────────
-- (Tiers are not sensitive — they just contain discount percentages and names)
DROP POLICY IF EXISTS "portal: read partner tiers" ON public.partner_tiers;

CREATE POLICY "portal: read partner tiers"
  ON public.partner_tiers FOR SELECT
  TO authenticated
  USING (true);


-- ── VERIFY ───────────────────────────────────────────────────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
