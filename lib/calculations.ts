import type { DashboardOrder, RoastLine, PackagingOrder, PackagingItem } from '@/types'

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
// Returns one RoastLine per unique product, aggregated across all orders.
// lossFactorOverrides: { [productId]: number } — UI overrides that take precedence
// over the product's stored roast_loss_factor for this run only.
export function buildRoastSchedule(
  orders: DashboardOrder[],
  lossFactorOverrides: Record<number, number>
): RoastLine[] {
  const byProduct = new Map<number, {
    productId: number
    productName: string
    defaultLossFactor: number
    finishedWeightLbs: number
    bagCounts: { '12oz': number; '2lb': number; '5lb': number }
  }>()

  for (const order of orders) {
    for (const item of order.order_items) {
      const variant = item.product_variants
      const product = variant.products
      const weightLbs = SIZE_WEIGHTS_LBS[variant.size] ?? 0
      const lineWeightLbs = weightLbs * item.quantity

      if (!byProduct.has(product.id)) {
        byProduct.set(product.id, {
          productId: product.id,
          productName: product.name,
          defaultLossFactor: product.roast_loss_factor,
          finishedWeightLbs: 0,
          bagCounts: { '12oz': 0, '2lb': 0, '5lb': 0 },
        })
      }

      const entry = byProduct.get(product.id)!
      entry.finishedWeightLbs += lineWeightLbs
      entry.bagCounts[variant.size as '12oz' | '2lb' | '5lb'] += item.quantity
    }
  }

  return Array.from(byProduct.values()).map((entry) => {
    const lossFactor = lossFactorOverrides[entry.productId] ?? entry.defaultLossFactor
    return {
      productId:               entry.productId,
      productName:             entry.productName,
      roastLossFactorOverride: lossFactor,
      finishedWeightLbs:       entry.finishedWeightLbs,
      greenWeightLbs:          calcGreenWeight(entry.finishedWeightLbs, lossFactor),
      bagCounts:               entry.bagCounts,
    }
  })
}

// Build the per-order packaging list from selected orders.
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

// Format a number to 2 decimal places for display
export function fmtLbs(lbs: number): string {
  return lbs.toFixed(2)
}
