import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

const VALID_SIZES  = ['12oz', '2lb', '5lb'] as const
const VALID_TYPES  = ['percentage', 'amount_per_bag'] as const

// PUT /api/tiers/[id]/discount-rules
// Replaces all discount rules for a tier with the provided array.
// Body: { rules: { size, discount_type, discount_pct, discount_amount_cents }[] }
// Send an empty array to clear all rules for the tier.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const tierId = parseInt(id, 10)
  if (isNaN(tierId)) {
    return NextResponse.json({ error: 'Invalid tier id' }, { status: 400 })
  }

  let rules: Array<{
    size: string
    discount_type: string
    discount_pct: number
    discount_amount_cents: number
  }>
  try {
    const body = await request.json()
    rules = Array.isArray(body.rules) ? body.rules : []
    for (const r of rules) {
      if (!VALID_SIZES.includes(r.size as typeof VALID_SIZES[number])) {
        throw new Error(`Invalid size: ${r.size}`)
      }
      if (!VALID_TYPES.includes(r.discount_type as typeof VALID_TYPES[number])) {
        throw new Error(`Invalid discount_type: ${r.discount_type}`)
      }
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Delete all existing rules for this tier, then insert the new set
  const { error: deleteError } = await supabase
    .from('tier_discount_rules')
    .delete()
    .eq('tier_id', tierId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (rules.length > 0) {
    const toInsert = rules.map((r) => ({
      tier_id:              tierId,
      size:                 r.size,
      discount_type:        r.discount_type,
      discount_pct:         Number(r.discount_pct),
      discount_amount_cents: Math.round(Number(r.discount_amount_cents)),
    }))

    const { error: insertError } = await supabase
      .from('tier_discount_rules')
      .insert(toInsert)

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  const { data: updatedRules, error: fetchError } = await supabase
    .from('tier_discount_rules')
    .select('*')
    .eq('tier_id', tierId)
    .order('size')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(updatedRules ?? [])
}
