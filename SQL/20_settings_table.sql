-- Migration 20: Generic key/value settings table
-- Used for storing mutable integration credentials (e.g. QuickBooks OAuth tokens)
-- server-side only — accessed exclusively via the service role key, no RLS needed.

CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
