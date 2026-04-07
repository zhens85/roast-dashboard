import { createServerSupabaseClient } from '@/lib/supabase'
import {
  buildRoastSchedule,
  buildPackagingList,
  buildPackagingTotals,
  fmtLbs,
} from '@/lib/calculations'
import type { DashboardOrder, AliasMap } from '@/types'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'

async function fetchOrdersByIds(ids: number[]): Promise<DashboardOrder[]> {
  if (ids.length === 0) return []

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      partners (*),
      order_items (
        *,
        product_variants (
          *,
          products (*)
        )
      )
    `)
    .in('id', ids)
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  return (data as DashboardOrder[]) ?? []
}

async function fetchAliasMap(): Promise<AliasMap> {
  const supabase = createServerSupabaseClient()

  const { data: aliases, error: aliasError } = await supabase
    .from('product_aliases')
    .select('alias_product_id, canonical_product_id')

  if (aliasError || !aliases || aliases.length === 0) return {}  // table may not exist yet

  const canonicalIds = [...new Set(aliases.map((a) => a.canonical_product_id))]
  const { data: canonicals, error: productError } = await supabase
    .from('products')
    .select('id, name, roast_loss_factor')
    .in('id', canonicalIds)

  if (productError || !canonicals) return {}

  const canonicalById = Object.fromEntries(canonicals.map((p) => [p.id, p]))

  const aliasMap: AliasMap = {}
  for (const alias of aliases) {
    const canonical = canonicalById[alias.canonical_product_id]
    if (!canonical) continue
    aliasMap[alias.alias_product_id] = {
      id:         canonical.id,
      name:       canonical.name,
      lossFactor: Number(canonical.roast_loss_factor),
    }
  }

  return aliasMap
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ orders?: string }>
}) {
  const params = await searchParams
  const rawIds = params.orders ?? ''
  const orderIds = rawIds
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n))

  const [orders, aliasMap] = await Promise.all([
    fetchOrdersByIds(orderIds),
    fetchAliasMap(),
  ])

  // Use stored loss factors — no UI overrides on the print page.
  // Staff adjusts overrides on the main dashboard, then opens print view.
  const roastSchedule  = buildRoastSchedule(orders, {}, aliasMap)
  const packagingList  = buildPackagingList(orders)
  const packagingTotals = buildPackagingTotals(orders, aliasMap)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const totalFinished = roastSchedule.reduce((s, l) => s + l.finishedWeightLbs, 0)
  const totalGreen    = roastSchedule.reduce((s, l) => s + l.greenWeightLbs, 0)

  return (
    <div className="max-w-3xl mx-auto p-8 font-sans text-sm text-stone-900">

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Roast Run</h1>
          <p className="text-stone-500 text-xs mt-1">{today}</p>
          <p className="text-stone-600 mt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''} ·{' '}
            {fmtLbs(totalGreen)} lbs green coffee total
          </p>
        </div>
        <PrintButton />
      </div>

      {orders.length === 0 ? (
        <p className="text-stone-500">No orders selected. Close this tab and select orders first.</p>
      ) : (
        <>
          {/* ── ROAST SCHEDULE ── */}
          <section className="mb-8">
            <h2 className="text-base font-bold border-b-2 border-stone-300 pb-1 mb-3">
              Roast Schedule
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-200">
                  <th className="pb-2 pr-4">Coffee</th>
                  <th className="pb-2 pr-4 text-right">Finished (lbs)</th>
                  <th className="pb-2 pr-4 text-center">Loss %</th>
                  <th className="pb-2 text-right">Green (lbs)</th>
                </tr>
              </thead>
              <tbody>
                {roastSchedule.map((line) => (
                  <tr key={line.productId} className="border-t border-stone-100">
                    <td className="py-2 pr-4">
                      <span className="font-medium">{line.productName}</span>
                      {line.aliases.length > 0 && (
                        <div className="text-stone-400 text-xs mt-0.5">
                          includes:{' '}
                          {line.aliases.map((a, j) => (
                            <span key={a.productId}>
                              {a.productName}
                              {j < line.aliases.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">{fmtLbs(line.finishedWeightLbs)}</td>
                    <td className="py-2 pr-4 text-center text-stone-500">
                      {(line.roastLossFactorOverride * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 text-right font-semibold">{fmtLbs(line.greenWeightLbs)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-400 font-bold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right">{fmtLbs(totalFinished)}</td>
                  <td />
                  <td className="pt-2 text-right">{fmtLbs(totalGreen)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* ── PACKAGING TOTALS ── */}
          {/* Each label shown individually so the team knows exactly how      */}
          {/* many bags to prepare under each product name. "From Roast" shows */}
          {/* which batch to pull from when a product is a house-blend alias.  */}
          <section className="mb-8">
            <h2 className="text-base font-bold border-b-2 border-stone-300 pb-1 mb-3">
              Packaging Totals
            </h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-500 text-left border-b border-stone-200">
                  <th className="pb-2 pr-4">Label / Product</th>
                  <th className="pb-2 pr-4">From Roast</th>
                  <th className="pb-2 pr-4 text-center">12oz</th>
                  <th className="pb-2 pr-4 text-center">2lb</th>
                  <th className="pb-2 text-center">5lb</th>
                </tr>
              </thead>
              <tbody>
                {packagingTotals.map((line) => (
                  <tr key={line.productId} className="border-t border-stone-100">
                    <td className="py-1.5 pr-4 font-medium">{line.productName}</td>
                    <td className="py-1.5 pr-4 text-stone-500">
                      {line.canonicalProductName ?? '—'}
                    </td>
                    <td className="py-1.5 pr-4 text-center">
                      {line.bagCounts['12oz'] > 0 ? `${line.bagCounts['12oz']}×` : '—'}
                    </td>
                    <td className="py-1.5 pr-4 text-center">
                      {line.bagCounts['2lb'] > 0 ? `${line.bagCounts['2lb']}×` : '—'}
                    </td>
                    <td className="py-1.5 text-center">
                      {line.bagCounts['5lb'] > 0 ? `${line.bagCounts['5lb']}×` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── PER ORDER BREAKDOWN ── */}
          <section className="mb-8">
            <h2 className="text-base font-bold border-b-2 border-stone-300 pb-1 mb-3">
              Per-Order Breakdown
            </h2>
            <div className="space-y-4">
              {packagingList.map((packOrder) => (
                <div key={packOrder.orderId} className="border-t border-stone-100 pt-3">
                  <div className="font-semibold">
                    {packOrder.companyName}{' '}
                    <span className="text-stone-400 font-normal text-xs">
                      #{packOrder.orderId}
                    </span>
                    <span className="text-stone-500 font-normal ml-2 text-xs">
                      — {packOrder.partnerName}
                    </span>
                  </div>
                  {packOrder.notes && (
                    <div className="text-xs text-stone-500 italic mt-0.5">
                      Note: {packOrder.notes}
                    </div>
                  )}
                  <ul className="ml-3 space-y-0.5 mt-1.5">
                    {packOrder.items.map((item, i) => (
                      <li key={i} className="text-stone-700">
                        <span className="font-medium">{item.quantity}×</span>{' '}
                        {item.productName}{' '}
                        <span className="text-stone-500">{item.size}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Bottom print button */}
      <div className="mt-8 print:hidden text-center">
        <PrintButton />
      </div>
    </div>
  )
}
