-- ============================================================
-- SHOPIFY PRODUCTS IMPORT
-- Generated from products_export.csv on 2026-04-07
--
-- Step 0 fixes the size check constraint to allow '12oz Ground'.
-- Steps 1-2 insert products and variants (safe to re-run).
-- ============================================================

-- ── 0. FIX SIZE CONSTRAINT ───────────────────────────────────────────────────
ALTER TABLE public.product_variants
  DROP CONSTRAINT IF EXISTS product_variants_size_check;

ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_size_check
  CHECK (size IN ('12oz', '12oz Ground', '2lb', '5lb'));


-- ── 1. PRODUCTS ──────────────────────────────────────────────────────────────

INSERT INTO public.products (name, description, roast_level, is_active, roast_loss_factor)
SELECT v.name, v.description, v.roast_level, v.is_active, v.roast_loss_factor
FROM (VALUES
  ('Day Tripper Medium Roast',      'Balanced, Round, & Smooth. Chocolate and caramel flavors are the stars in this sweet and smooth blend. Perfect as a morning cup, afternoon cold brew, or nightcap.',    'medium', true,  0.15),
  ('Globe Trotter Dark Roast',      'Rich, Bold, & Extravagant. Dark chocolate and nutty flavors are highlighted in this thoughtful dark roast. Coffees from around the world roasted to bold perfection.',  'dark',   true,  0.18),
  ('Fast Track Espresso',           'Sophisticated & Classic Espresso. Dark brown sugar, caramel, and semi-sweet chocolate. Roasted for espresso, equally delicious as drip.',                              'medium', true,  0.16),
  ('Deep Space',                    'Smokey, Bold, & Dark Chocolate. Roasted specifically with the dark roast lover in mind.',                                                                               'dark',   true,  0.18),
  ('Half-Caf',                      'A 50/50 blend of Fast Track Espresso and Colombia Sugarcane Decaf. All the flavor, half the caffeine.',                                                                'medium', true,  0.15),
  ('Spring Blend',                  'Melon, milk chocolate, cane sugar, citrus, and sparkling acidity. A delicious and perfectly balanced cup of coffee.',                                                   'medium', true,  0.15),
  ('Slow Track Espresso',           'Classic Dark(er) Espresso. Dark chocolate, caramel, and semi-sweet chocolate. Designed for espresso, brews well as drip or french press.',                            'dark',   true,  0.18),
  ('Hot Cup of Get Up',             'Milk Chocolate, Tropical Fruit, & Caramelized Sugar. An all-day sipper coffee featuring in-season coffees.',                                                           'medium', true,  0.15),
  ('Decaf Colombia Sugar Cane',     'Dried Fruit, Brown Sugar, & Baker''s Chocolate. Colombia Cauca, Sugar Cane decaffeination process.',                                                                   'medium', true,  0.15),
  ('Peru Cajamarca',                'Milky Way. Cajamarca, Peru. Fully Washed. Typica, Caturra, Catimor, Pache. 1650–1800 MASL.',                                                                          'light',  true,  0.14),
  ('Colombia Medium Roast',         'Chocolate, Cherry, & Floral. Huila, Colombia. Various Smallholders. Fully Washed. 1200–2000 MASL.',                                                                   'medium', true,  0.15),
  ('Guatemala Medium Roast',        'Baker''s Chocolate, Caramel & Creamy. Huehuetenango. Various Smallholders. Fully Washed. 1100–1800 MASL.',                                                            'medium', true,  0.15),
  ('Guatemala Waykan',              'Red Apple, Milk Chocolate, Hibiscus & Creamy. Huehuetenango. Various Smallholders. Fully Washed. 1100–1800 MASL.',                                                    'light',  true,  0.14),
  ('Father''s Day Blend',           'Peru, Colombia, and Papua New Guinea. Cherry Cola, Chocolate, Spices, and a Creamy body.',                                                                             'medium', false, 0.15),
  ('Christmas Blend',               'Guatemala, Colombia, and Ethiopia. Chocolate, Dried Fruit, Baking Spices, and Roasted Nuts.',                                                                          'medium', false, 0.15),
  ('Free Fallin''',                 'A unique blend of in-season coffees from Colombia, Guatemala, and Mexico. Roasted with cool Autumn mornings in mind.',                                                 'medium', false, 0.15),
  ('Mother''s Day Blend',           'Guatemala Waykan, Colombia Andres, and Tanzania Peaberry. Chocolate, Floral Bouquet, Spices, and a Creamy body.',                                                      'medium', false, 0.15),
  ('Kenya',                         'Nyeri. Washed. SL 28, SL 34, Batian, Ruiru 11. 1500–1800 MASL.',                                                                                                      'light',  false, 0.14),
  ('Papua New Guinea',              'Semi-Sweet Chocolate, Grapefruit, Sugar Cane & Baking Spices. Namugo. Washed. 1400–1800 Meters.',                                                                     'medium', false, 0.15),
  ('Ethiopia Guji',                 'Jasmine, Lemon-Lime, & Apricot. Guji. 850 Smallholders. Washed. Heirloom Ethiopian Varietals. 1950–2150 Meters.',                                                     'light',  false, 0.14),
  ('Ethiopia Yirgacheffe Natural',  'Chocolate, Red Fruit, Cane Sugar. Gedeb. Halo Beriti Washing Station. Natural. Heirloom Ethiopian Varieties. 2100–2300 Meters.',                                      'light',  false, 0.14),
  ('Guatemala Doña Maria (Light)',  'Todos Santos Cuchumatan, Huehuetenango. Finca El Rinconcito. Washed. Direct trade microlot from Doña Maria Velasquez.',                                                'light',  false, 0.14),
  ('Guatemala Doña Maria (Medium)', 'Todos Santos Cuchumatan, Huehuetenango. Finca El Rinconcito. Washed. Medium roast profile. Direct trade microlot.',                                                    'medium', false, 0.15),
  ('Tanzania Peaberry',             'Southern Highlands, Songwe, Mbozi. Various Smallholders. Washed. N 39, KP 423. 1500–1900 Meters.',                                                                    'medium', false, 0.15)
) AS v(name, description, roast_level, is_active, roast_loss_factor)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products WHERE name = v.name
);


-- ── 2. PRODUCT VARIANTS ──────────────────────────────────────────────────────

INSERT INTO public.product_variants (product_id, size, sku, price_cents, is_available)
SELECT p.id, v.size, v.sku, v.price_cents, v.is_available
FROM (VALUES
  -- Day Tripper Medium Roast
  ('Day Tripper Medium Roast',      '12oz',       'BL-DAYTRIPPER-12WB',  1900, true),
  ('Day Tripper Medium Roast',      '12oz Ground','BL-DAYTRIPPER-12G',   1900, true),
  ('Day Tripper Medium Roast',      '2lb',        'BL-DAYTRIPPER-2WB',   3900, true),
  ('Day Tripper Medium Roast',      '5lb',        'BL-DAYTRIPPER-5WB',   8700, true),
  -- Globe Trotter Dark Roast
  ('Globe Trotter Dark Roast',      '12oz',       'BL-GLOBETROTTER-12WB',1900, true),
  ('Globe Trotter Dark Roast',      '12oz Ground','BL-GLOBETROTTER-12G', 1900, true),
  ('Globe Trotter Dark Roast',      '2lb',        'BL-GLOBETROTTER-2WB', 3900, true),
  ('Globe Trotter Dark Roast',      '5lb',        'BL-GLOBETROTTER-5WB', 8700, true),
  -- Fast Track Espresso
  ('Fast Track Espresso',           '12oz',       'BL-FASTTRACK-12WB',   1900, true),
  ('Fast Track Espresso',           '12oz Ground','BL-FASTTRACK-12G',    1900, true),
  ('Fast Track Espresso',           '2lb',        'BL-FASTTRACK-2WB',    3900, true),
  ('Fast Track Espresso',           '5lb',        'BL-FASTTRACK-5WB',    8700, true),
  -- Deep Space
  ('Deep Space',                    '12oz',       'BL-DEEPSPACE-12WB',   1900, true),
  ('Deep Space',                    '12oz Ground','BL-DEEPSPACE-12G',    1900, true),
  ('Deep Space',                    '2lb',        'BL-DEEPSPACE-2WB',    3900, true),
  ('Deep Space',                    '5lb',        'BL-DEEPSPACE-5WB',    8700, true),
  -- Half-Caf
  ('Half-Caf',                      '12oz',       'BL-HALFCAF-12WB',     1900, true),
  ('Half-Caf',                      '12oz Ground','BL-HALFCAF-12G',      1900, true),
  ('Half-Caf',                      '2lb',        'BL-HALFCAF-2WB',      3900, true),
  ('Half-Caf',                      '5lb',        'BL-HALFCAF-5WB',      8700, true),
  -- Spring Blend
  ('Spring Blend',                  '12oz',       'BL-SPRINGBLEND-12WB', 1900, true),
  ('Spring Blend',                  '12oz Ground','BL-SPRINGBLEND-12G',  1900, true),
  ('Spring Blend',                  '2lb',        'BL-SPRINGBLEND-2WB',  3900, true),
  ('Spring Blend',                  '5lb',        'BL-SPRINGBLEND-5WB',  8700, true),
  -- Slow Track Espresso
  ('Slow Track Espresso',           '12oz',       'BL-SLOWTRACK-12WB',   1900, true),
  ('Slow Track Espresso',           '12oz Ground','BL-SLOWTRACK-12G',    1900, true),
  ('Slow Track Espresso',           '2lb',        'BL-SLOWTRACK-2WB',    3900, true),
  ('Slow Track Espresso',           '5lb',        'BL-SLOWTRACK-5WB',    8700, true),
  -- Hot Cup of Get Up
  ('Hot Cup of Get Up',             '12oz',       'BL-HCOGU-12WB',       1900, true),
  ('Hot Cup of Get Up',             '12oz Ground','BL-HCOGU-12G',        1900, true),
  ('Hot Cup of Get Up',             '2lb',        'BL-HCOGU-2WB',        3900, true),
  ('Hot Cup of Get Up',             '5lb',        'BL-HCOGU-5WB',        8700, true),
  -- Decaf Colombia Sugar Cane
  ('Decaf Colombia Sugar Cane',     '12oz',       'SO-DECAF-12WB',       1900, true),
  ('Decaf Colombia Sugar Cane',     '12oz Ground','SO-DECAF-12G',        1900, true),
  ('Decaf Colombia Sugar Cane',     '2lb',        'SO-DECAF-2WB',        3900, true),
  ('Decaf Colombia Sugar Cane',     '5lb',        'SO-DECAF-5WB',        8700, true),
  -- Peru Cajamarca
  ('Peru Cajamarca',                '12oz',       'SO-PERU-12WB',        1900, true),
  ('Peru Cajamarca',                '12oz Ground','SO-PERU-12G',         1900, true),
  ('Peru Cajamarca',                '2lb',        'SO-PERU-2WB',         3900, true),
  ('Peru Cajamarca',                '5lb',        'SO-PERU-5WB',         8700, true),
  -- Colombia Medium Roast
  ('Colombia Medium Roast',         '12oz',       'SO-COLMED-12WB',      1900, true),
  ('Colombia Medium Roast',         '12oz Ground','SO-COLMED-12G',       1900, true),
  ('Colombia Medium Roast',         '2lb',        'SO-COLMED-2WB',       3900, true),
  ('Colombia Medium Roast',         '5lb',        'SO-COLMED-5WB',       8700, true),
  -- Guatemala Medium Roast
  ('Guatemala Medium Roast',        '12oz',       'SO-GUATMED-12WB',     1900, true),
  ('Guatemala Medium Roast',        '12oz Ground','SO-GUATMED-12G',      1900, true),
  ('Guatemala Medium Roast',        '2lb',        'SO-GUATMED-2WB',      3900, true),
  ('Guatemala Medium Roast',        '5lb',        'SO-GUATMED-5WB',      8700, true),
  -- Guatemala Waykan
  ('Guatemala Waykan',              '12oz',       'SO-WAYKAN-12WB',      1900, true),
  ('Guatemala Waykan',              '12oz Ground','SO-WAYKAN-12G',       1900, true),
  ('Guatemala Waykan',              '2lb',        'SO-WAYKAN-2WB',       3900, true),
  ('Guatemala Waykan',              '5lb',        'SO-WAYKAN-5WB',       8700, true),
  -- Father's Day Blend
  ('Father''s Day Blend',           '12oz',       'BL-FATHERSDAY-12WB',  1900, false),
  ('Father''s Day Blend',           '12oz Ground','BL-FATHERSDAY-12G',   1900, false),
  ('Father''s Day Blend',           '2lb',        'BL-FATHERSDAY-2WB',   3900, false),
  ('Father''s Day Blend',           '5lb',        'BL-FATHERSDAY-5WB',   8700, false),
  -- Christmas Blend
  ('Christmas Blend',               '12oz',       'BL-COLHONEY-12WB',    1900, false),
  ('Christmas Blend',               '12oz Ground','BL-COLHONEY-12G',     1900, false),
  ('Christmas Blend',               '2lb',        'BL-COLHONEY-2WB',     3900, false),
  ('Christmas Blend',               '5lb',        'BL-COLHONEY-5WB',     8700, false),
  -- Free Fallin'
  ('Free Fallin''',                 '12oz',       'BL-FALL-12WB',        1900, false),
  ('Free Fallin''',                 '12oz Ground','BL-FALL-12G',         1900, false),
  ('Free Fallin''',                 '2lb',        'BL-FALL-2WB',         3900, false),
  ('Free Fallin''',                 '5lb',        'BL-FALL-5WB',         8700, false),
  -- Mother's Day Blend
  ('Mother''s Day Blend',           '12oz',       'BL-MOTHERSDAY-12WB',  1900, false),
  ('Mother''s Day Blend',           '12oz Ground','BL-MOTHERSDAY-12G',   1900, false),
  ('Mother''s Day Blend',           '2lb',        'BL-MOTHERSDAY-2WB',   3900, false),
  ('Mother''s Day Blend',           '5lb',        'BL-MOTHERSDAY-5WB',   8700, false),
  -- Kenya
  ('Kenya',                         '12oz',       'SO-KENYA-12WB',       1900, false),
  ('Kenya',                         '12oz Ground','SO-KENYA-12G',        1900, false),
  ('Kenya',                         '2lb',        'SO-KENYA-2WB',        3900, false),
  ('Kenya',                         '5lb',        'SO-KENYA-5WB',        8700, false),
  -- Papua New Guinea
  ('Papua New Guinea',              '12oz',       'SO-PNG-12WB',         1900, false),
  ('Papua New Guinea',              '12oz Ground','SO-PNG-12G',          1900, false),
  ('Papua New Guinea',              '2lb',        'SO-PNG-2WB',          3900, false),
  ('Papua New Guinea',              '5lb',        'SO-PNG-5WB',          8700, false),
  -- Ethiopia Guji (also covers Ethiopia Tega & Tula — same SKUs, same coffee)
  ('Ethiopia Guji',                 '12oz',       'SO-ETHIOPIA-12WB',    1900, false),
  ('Ethiopia Guji',                 '12oz Ground','SO-ETHIOPIA-12G',     1900, false),
  ('Ethiopia Guji',                 '2lb',        'SO-ETHIOPIA-2WB',     3900, false),
  ('Ethiopia Guji',                 '5lb',        'SO-ETHIOPIA-5WB',     8700, false),
  -- Ethiopia Yirgacheffe Natural
  ('Ethiopia Yirgacheffe Natural',  '12oz',       'SO-ETHIOPIANAT-12WB', 1900, false),
  ('Ethiopia Yirgacheffe Natural',  '12oz Ground','SO-ETHIOPIANAT-12G',  1900, false),
  ('Ethiopia Yirgacheffe Natural',  '2lb',        'SO-ETHIOPIANAT-2WB',  3900, false),
  ('Ethiopia Yirgacheffe Natural',  '5lb',        'SO-ETHIOPIANAT-5WB',  8700, false),
  -- Guatemala Doña Maria (Light) — premium pricing
  ('Guatemala Doña Maria (Light)',  '12oz',       'SO-MARIA-12WB',       2200, false),
  ('Guatemala Doña Maria (Light)',  '12oz Ground','SO-MARIA-12G',        2200, false),
  ('Guatemala Doña Maria (Light)',  '2lb',        'SO-MARIA-2WB',        4700, false),
  ('Guatemala Doña Maria (Light)',  '5lb',        'SO-MARIA-5WB',       10700, false),
  -- Guatemala Doña Maria (Medium)
  ('Guatemala Doña Maria (Medium)', '12oz',       'SO-MARIAMED-12WB',    1900, false),
  ('Guatemala Doña Maria (Medium)', '12oz Ground','SO-MARIAMED-12G',     1900, false),
  ('Guatemala Doña Maria (Medium)', '2lb',        'SO-MARIAMED-2WB',     3900, false),
  ('Guatemala Doña Maria (Medium)', '5lb',        'SO-MARIAMED-5WB',     8700, false),
  -- Tanzania Peaberry
  ('Tanzania Peaberry',             '12oz',       'SO-TANZ-12WB',        1900, false),
  ('Tanzania Peaberry',             '12oz Ground','SO-TANZ-12G',         1900, false),
  ('Tanzania Peaberry',             '2lb',        'SO-TANZ-2WB',         3900, false),
  ('Tanzania Peaberry',             '5lb',        'SO-TANZ-5WB',         8700, false)
) AS v(product_name, size, sku, price_cents, is_available)
JOIN public.products p ON p.name = v.product_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_variants WHERE sku = v.sku
);


-- ── 3. VERIFY ────────────────────────────────────────────────────────────────
SELECT
  p.name,
  p.roast_level,
  p.is_active,
  COUNT(pv.id) AS variant_count
FROM public.products p
LEFT JOIN public.product_variants pv ON pv.product_id = p.id
GROUP BY p.id, p.name, p.roast_level, p.is_active
ORDER BY p.is_active DESC, p.name;
