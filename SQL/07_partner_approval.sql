-- Migration: Add partner approval gate
-- Run this in the Supabase SQL Editor.
--
-- Partners who self-sign-up via the portal are not approved by default.
-- Staff-created partners (via the admin dashboard) are approved immediately.
-- Unapproved partners can create an account but cannot log in or place orders.

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Existing partners (created before this migration) are all approved already.
UPDATE public.partners SET is_approved = true;

COMMENT ON COLUMN public.partners.is_approved IS
  'Staff must set this to true before the partner can access the portal. '
  'Automatically true for accounts created by staff via the dashboard.';
