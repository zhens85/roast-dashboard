import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

const VALID_DISCOUNT_TYPES = ['percentage', 'amount_per_bag'] as const

// GET /api/tiers — list all tiers
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_tiers')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tiers — create a new tier
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let name: string
  let discount_type: string
  let discount_pct: number
  let discount_amount_cents: number
  try {
    const body = await request.json()
    name                  = body.name?.trim()
    discount_type         = body.discount_type ?? 'percentage'
    discount_pct          = Number(body.discount_pct ?? 0)
    discount_amount_cents = Math.round(Number(body.discount_amount_cents ?? 0))

    if (!name) throw new Error('name is required')
    if (!VALID_DISCOUNT_TYPES.includes(discount_type as typeof VALID_DISCOUNT_TYPES[number])) {
      throw new Error('discount_type must be percentage or amount_per_bag')
    }
    if (discount_type === 'percentage' && (isNaN(discount_pct) || discount_pct < 0 || discount_pct >= 100)) {
      throw new Error('discount_pct must be 0–99.99')
    }
    if (discount_type === 'amount_per_bag' && (isNaN(discount_amount_cents) || discount_amount_cents < 0)) {
      throw new Error('discount_amount_cents must be >= 0')
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('partner_tiers')
    .insert({ name, discount_type, discount_pct, discount_amount_cents })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
