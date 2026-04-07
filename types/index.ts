// ============================================================
// Database types — mirror the Supabase schema exactly (snake_case)
// ============================================================

export interface PartnerTier {
  id: number
  name: string
  // IMPORTANT: Postgres NUMERIC arrives as a string in JSON.
  // Always cast with Number(tier.discount_pct) before arithmetic.
  discount_pct: number
  created_at: string
}

export interface Partner {
  id: string
  email: string
  company_name: string
  contact_person: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  tier_id: number | null
  is_approved: boolean
  partner_tiers: PartnerTier | null  // embedded via join: partners(*,partner_tiers(*))
  created_at: string
}

export interface Product {
  id: number
  name: string
  description: string | null
  origin_region: string | null
  roast_level: 'light' | 'medium' | 'medium-dark' | 'dark' | null
  process_method: string | null
  is_active: boolean
  image_url: string | null
  roast_loss_factor: number   // NUMERIC default 0.15
  visible_to_tiers: number[] | null  // NULL/empty = visible to all tiers
  created_at: string
}

export interface ProductVariant {
  id: number
  product_id: number
  size: '12oz' | '2lb' | '5lb'
  price_cents: number
  sku: string
  is_available: boolean
  created_at: string
}

export interface ShopifyShippingAddress {
  name:          string | null
  company:       string | null
  address1:      string | null
  address2:      string | null
  city:          string | null
  province_code: string | null
  zip:           string | null
  country_code:  string | null
  phone:         string | null
}

export interface Order {
  id: number
  // null for Shopify orders that couldn't be matched to a partner account
  partner_id:         string | null
  status:             'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total_amount_cents: number
  notes:              string | null
  // 'portal' = placed via the wholesale ordering portal
  // 'shopify' = imported from the Shopify store via webhook
  source:             'portal' | 'shopify'
  // Shopify order ID (e.g. "shopify_12345678") — used for deduplication
  external_id:        string | null
  // Populated for Shopify orders when no partner account email match was found
  customer_name:      string | null
  customer_email:     string | null
  shipping_address:   ShopifyShippingAddress | null
  created_at:         string
}

export interface OrderItem {
  id: number
  order_id: number
  product_variant_id: number
  quantity: number
  unit_price_cents: number
  created_at: string
}

// ============================================================
// Portal-specific types (partner ordering web app)
// ============================================================

// Product with its variants embedded — used on the portal products page
export interface PortalProduct extends Product {
  product_variants: ProductVariant[]
}

// Cart item stored in localStorage (key: 'coffee_cart')
// unitPriceCents is already discounted — matches what will be written to order_items
export interface CartItem {
  variantId: number
  productId: number
  productName: string
  size: '12oz' | '2lb' | '5lb'
  quantity: number
  unitPriceCents: number   // already has discount applied
  sku: string
}

// ============================================================
// Denormalized shape returned by the joined dashboard query
// ============================================================

export interface DashboardOrderItem extends OrderItem {
  product_variants: ProductVariant & {
    products: Product
  }
}

export interface DashboardOrder extends Order {
  // null when the order came from Shopify and no partner email match was found
  partners: Partner | null
  order_items: DashboardOrderItem[]
}

// ============================================================
// Portal order history types
// ============================================================

export interface PortalOrderItem extends OrderItem {
  product_variants: ProductVariant & {
    products: Pick<Product, 'id' | 'name'>
  }
}

export interface PortalOrder extends Order {
  order_items: PortalOrderItem[]
}

// ============================================================
// Product alias types — for roast schedule consolidation
// ============================================================

// Raw row from the product_aliases table.
export interface ProductAlias {
  alias_product_id: number
  canonical_product_id: number
  created_at: string
}

// Resolved canonical product info, used by buildRoastSchedule.
// Key: alias_product_id → value: the canonical product's id, name, and loss factor.
export interface AliasCanonical {
  id: number
  name: string
  lossFactor: number
}
export type AliasMap = Record<number, AliasCanonical>

// ============================================================
// Computed types for roast run state (local only, never saved)
// ============================================================

// Per-alias breakdown within a consolidated roast line.
// Shows how many bags of each alias label come from a single roast batch.
export interface RoastAliasEntry {
  productId: number
  productName: string
  bagCounts: {
    '12oz': number
    '2lb': number
    '5lb': number
  }
}

export interface RoastLine {
  productId: number
  productName: string
  roastLossFactorOverride: number
  finishedWeightLbs: number
  greenWeightLbs: number
  bagCounts: {
    '12oz': number
    '2lb': number
    '5lb': number
  }
  // Populated when alias products are consolidated into this roast line.
  // Empty array means this product has no aliases in the current order set.
  aliases: RoastAliasEntry[]
}

export interface PackagingItem {
  productName: string
  size: '12oz' | '2lb' | '5lb'
  quantity: number
}

export interface PackagingOrder {
  orderId: number
  partnerName: string
  companyName: string
  notes: string | null
  items: PackagingItem[]
}

// Per-original-product packaging totals (no alias consolidation).
// Used in the packaging totals table so staff knows exactly how many bags
// to label with each product name, regardless of what was roasted.
export interface PackagingTotalLine {
  productId: number
  productName: string
  // The canonical product this aliases to, or null if standalone.
  canonicalProductId: number | null
  canonicalProductName: string | null
  bagCounts: {
    '12oz': number
    '2lb': number
    '5lb': number
  }
}
