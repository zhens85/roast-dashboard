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

export interface Order {
  id: number
  partner_id: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  total_amount_cents: number
  notes: string | null
  created_at: string
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
  partners: Partner
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
// Computed types for roast run state (local only, never saved)
// ============================================================

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
