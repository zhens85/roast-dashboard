import type {
  DashboardOrder,
  RoastLine,
  RoastAliasEntry,
  PackagingOrder,
  PackagingItem,
  PackagingTotalLine,
  AliasMap,
} from '@/types'

// Weight of each bag size in pounds
export const SIZE_WEIGHTS_LBS: Record<string, number> = {
  '12oz': 0.75,
  '2lb':  2.0,
  '5lb':  5.0,
}

// Green coffee weight needed given a target finished weight and roast loss factor.
// Formula: green = finished / (1 - loss_factor)
// Example: 3.57 lbs finished at 15% loss → 3.57 / 0.85 = 4.2 lbs green
export function calcGreenWeight(finishedLbs: number, lossFactor: number): number {
  if (lossFactor <= 0 || lossFactor >= 1) {
    throw new RangeError(`roast_loss_factor must be between 0 and 1, got ${lossFactor}`)
  }
  return finishedLbs / (1 - lossFactor)
}

// Compute the full roast schedule from a set of selected orders.
// Returns one RoastLine per unique *canonical* product, aggregating alias products
// into their canonical entry so the roaster sees a single consolidated weight.
//
// aliasMap: { [alias_product_id]: { id, name, lossFactor } }
//   — built server-side by resolving product_aliases rows against the products table.
//   — pass {} (empty) when no aliases exist or are not yet loaded.
//
// lossFactorOverrides: { [productId]: number }
//   — UI overrides that take precedence over the canonical product's stored factor.
export function buildRoastSchedule(
  orders: DashboardOrder[],
  lossFactorOverrides: Record<number, number>,
  aliasMap: AliasMap = {}
): RoastLine[] {
  // Map keyed by CANONICAL product ID
  const byProduct = new Map<number, {
    productId: number
    productName: string
    defaultLossFactor: number
    finishedWeightLbs: number
    bagCounts: { '12oz': number; '2lb': number; '5lb': number }
    // Tracks per-alias bag breakdown when aliases are consolidated in
    aliasData: Map<number, {
      productId: number
      productName: string
      bagCounts: { '12oz': number; '2lb': number; '5lb': number }
    }>
  }>()

  for (const order of orders) {
    for (const item of order.order_items) {
      const variant  = item.product_variants
      const product  = variant.products
      const weightLbs     = SIZE_WEIGHTS_LBS[variant.size] ?? 0
      const lineWeightLbs = weightLbs * item.quantity

      // Resolve alias: if this product is an alias, group under canonical
      const canonical     = aliasMap[product.id]
      const canonicalId   = canonical ? canonical.id         : product.id
      const canonicalName = canonical ? canonical.name       : product.name
      const canonicalLoss = canonical ? canonical.lossFactor : product.roast_loss_factor
      const isAlias       = !!canonical

      if (!byProduct.has(canonicalId)) {
        byProduct.set(canonicalId, {
          productId:        canonicalId,
          productName:      canonicalName,
          defaultLossFactor: canonicalLoss,
          finishedWeightLbs: 0,
          bagCounts:        { '12oz': 0, '2lb': 0, '5lb': 0 },
          aliasData:        new Map(),
        })
      }

      const entry = byProduct.get(canonicalId)!
      entry.finishedWeightLbs += lineWeightLbs
      entry.bagCounts[variant.size as '12oz' | '2lb' | '5lb'] += item.quantity

      // Track per-alias breakdown for display in the roast schedule
      if (isAlias) {
        if (!entry.aliasData.has(product.id)) {
          entry.aliasData.set(product.id, {
            productId:   product.id,
            productName: product.name,
            bagCounts:   { '12oz': 0, '2lb': 0, '5lb': 0 },
          })
        }
        const aliasEntry = entry.aliasData.get(product.id)!
        aliasEntry.bagCounts[variant.size as '12oz' | '2lb' | '5lb'] += item.quantity
      }
    }
  }

  return Array.from(byProduct.values()).map((entry) => {
    const lossFactor = lossFactorOverrides[entry.productId] ?? entry.defaultLossFactor
    const aliases: RoastAliasEntry[] = Array.from(entry.aliasData.values())

    return {
      productId:               entry.productId,
      productName:             entry.productName,
      roastLossFactorOverride: lossFactor,
      finishedWeightLbs:       entry.finishedWeightLbs,
      greenWeightLbs:          calcGreenWeight(entry.finishedWeightLbs, lossFactor),
      bagCounts:               entry.bagCounts,
      aliases,
    }
  })
}

// Build the per-order packaging list from selected orders.
// Product names are preserved as-ordered (no alias consolidation) so each
// partner's pick slip shows their own product label.
export function buildPackagingList(orders: DashboardOrder[]): PackagingOrder[] {
  return orders.map((order) => {
    const items: PackagingItem[] = order.order_items.map((item) => ({
      productName: item.product_variants.products.name,
      size:        item.product_variants.size,
      quantity:    item.quantity,
    }))

    return {
      orderId:     order.id,
      partnerName: order.partners.contact_person,
      companyName: order.partners.company_name,
      notes:       order.notes,
      items,
    }
  })
}

// Build per-original-product packaging totals for the packaging totals table.
// Unlike buildRoastSchedule, this does NOT consolidate aliases — each product
// keeps its own name so staff knows exactly how many bags to label with each name.
// canonicalProductId / canonicalProductName are included when the product is an
// alias, so staff can see which roast batch to pull from.
export function buildPackagingTotals(
  orders: DashboardOrder[],
  aliasMap: AliasMap = {}
): PackagingTotalLine[] {
  const byProduct = new Map<number, PackagingTotalLine>()

  for (const order of orders) {
    for (const item of order.order_items) {
      const variant = item.product_variants
      const product = variant.products
      const canonical = aliasMap[product.id] ?? null

      if (!byProduct.has(product.id)) {
        byProduct.set(product.id, {
          productId:           product.id,
          productName:         product.name,
          canonicalProductId:   canonical ? canonical.id   : null,
          canonicalProductName: canonical ? canonical.name : null,
          bagCounts:           { '12oz': 0, '2lb': 0, '5lb': 0 },
        })
      }

      byProduct.get(product.id)!.bagCounts[variant.size as '12oz' | '2lb' | '5lb'] += item.quantity
    }
  }

  return Array.from(byProduct.values())
}

// Format a number to 2 decimal places for display
export function fmtLbs(lbs: number): string {
  return lbs.toFixed(2)
}
