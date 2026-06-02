-- Migration 21: Partner locations for multi-location accounts
-- Allows one partner login to manage orders for multiple ship-to addresses.

-- 1. Locations table
CREATE TABLE public.partner_locations (
  id             BIGSERIAL    PRIMARY KEY,
  partner_id     UUID         NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name           TEXT         NOT NULL,          -- e.g. "Downtown", "East Side"
  contact_person TEXT,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  state          TEXT,
  zip_code       TEXT,
  is_default     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Only one default per partner (partial unique index)
CREATE UNIQUE INDEX partner_locations_one_default
  ON public.partner_locations (partner_id)
  WHERE is_default = TRUE;

-- 2. Link orders to a specific location (nullable — existing orders unaffected)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS location_id BIGINT
    REFERENCES public.partner_locations(id) ON DELETE SET NULL;

-- 3. RLS — partners can only manage their own locations
ALTER TABLE public.partner_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_locations_select_own"
  ON public.partner_locations FOR SELECT
  USING (auth.uid() = partner_id);

CREATE POLICY "partner_locations_insert_own"
  ON public.partner_locations FOR INSERT
  WITH CHECK (auth.uid() = partner_id);

CREATE POLICY "partner_locations_update_own"
  ON public.partner_locations FOR UPDATE
  USING (auth.uid() = partner_id);

CREATE POLICY "partner_locations_delete_own"
  ON public.partner_locations FOR DELETE
  USING (auth.uid() = partner_id);
