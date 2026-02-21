-- ============================================================
-- BULK PRODUCT IMPORT
-- Run this in Supabase Dashboard > SQL Editor AFTER uploading
-- products_import_template.csv to a staging table (see instructions).
-- ============================================================

-- Step 1: Create a temporary staging table that matches the CSV columns exactly.
-- Drop it first if you're re-running after a failed attempt.
DROP TABLE IF EXISTS public.products_import_staging;

CREATE TABLE public.products_import_staging (
    name               TEXT,
    description        TEXT,
    origin_region      TEXT,
    roast_level        TEXT,
    process_method     TEXT,
    roast_loss_factor  NUMERIC,
    image_url          TEXT,
    visible_to_tiers   TEXT,   -- comma-separated tier IDs e.g. "1,3" or blank for all
    size               TEXT,
    price_dollars      NUMERIC,
    sku                TEXT,
    is_available       TEXT    -- "true" or "false"
);

-- ============================================================
-- Step 2: Use Supabase Table Editor to import the CSV into
-- products_import_staging. See full instructions below.
-- ============================================================

-- Step 3: Insert distinct products (one row per unique product name).
-- Adjust visible_to_tiers parsing if your tier IDs differ.
INSERT INTO public.products (
    name,
    description,
    origin_region,
    roast_level,
    process_method,
    roast_loss_factor,
    image_url,
    visible_to_tiers,
    is_active
)
SELECT DISTINCT ON (name)
    name,
    NULLIF(TRIM(description), ''),
    NULLIF(TRIM(origin_region), ''),
    NULLIF(TRIM(roast_level), ''),
    NULLIF(TRIM(process_method), ''),
    COALESCE(roast_loss_factor, 0.15),
    NULLIF(TRIM(image_url), ''),
    -- Parse "1,3" → ARRAY[1,3]::integer[], blank/null → NULL
    CASE
        WHEN TRIM(COALESCE(visible_to_tiers, '')) = '' THEN NULL
        ELSE (
            SELECT ARRAY_AGG(TRIM(t)::INTEGER)
            FROM UNNEST(STRING_TO_ARRAY(TRIM(visible_to_tiers), ',')) AS t
        )
    END,
    TRUE
FROM public.products_import_staging
-- Skip products that already exist by name (safe to re-run)
WHERE name NOT IN (SELECT name FROM public.products);

-- Step 4: Insert product variants, joining back to the products table to get the new IDs.
INSERT INTO public.product_variants (
    product_id,
    size,
    price_cents,
    sku,
    is_available
)
SELECT
    p.id,
    s.size,
    ROUND(s.price_dollars * 100)::BIGINT,
    TRIM(s.sku),
    (TRIM(LOWER(s.is_available)) = 'true')
FROM public.products_import_staging s
JOIN public.products p ON p.name = s.name
-- Skip variants whose SKU already exists (safe to re-run)
WHERE TRIM(s.sku) NOT IN (SELECT sku FROM public.product_variants);

-- Step 5: Verify — review before committing
SELECT
    p.id,
    p.name,
    p.roast_level,
    p.visible_to_tiers,
    v.size,
    v.price_cents,
    v.sku,
    v.is_available
FROM public.products p
JOIN public.product_variants v ON v.product_id = p.id
ORDER BY p.name, v.size;

-- Step 6: Clean up the staging table when you're satisfied with the results.
-- DROP TABLE public.products_import_staging;
