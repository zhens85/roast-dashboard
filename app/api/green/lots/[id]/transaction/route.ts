import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET /api/green/lots/[id]/transaction — list all transactions for a lot
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const lotId = parseInt(id, 10)
  if (isNaN(lotId)) return NextResponse.json({ error: 'Invalid lot id' }, { status: 400 })

  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('green_lot_transactions')
    .select('*')
    .eq('green_lot_id', lotId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/green/lots/[id]/transaction — log a weight change or bag transfer
//
// For type = 'transferred':
//   - bag_count (required, positive = warehouse→roastery, negative = roastery→warehouse)
//   - weight_lbs is ignored / set to 0 — transfers don't change total weight
//
// For all other types (received, roasted, adjustment):
//   - weight_lbs (required, non-zero) — updates total_weight_lbs on the lot
//   - bag_count is ignored
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const lotId = parseInt(id, 10)
  if (isNaN(lotId)) return NextResponse.json({ error: 'Invalid lot id' }, { status: 400 })

  let body: {
    type: 'received' | 'transferred' | 'roasted' | 'adjustment'
    weight_lbs?: number
    bag_count?: number
    location_from?: string | null
    location_to?: string | null
    notes?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type } = body
  const validTypes = ['received', 'transferred', 'roasted', 'adjustment']
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate inputs per type
  if (type === 'transferred') {
    const bags = body.bag_count
    if (!bags || bags === 0 || isNaN(Number(bags))) {
      return NextResponse.json(
        { error: 'bag_count must be a non-zero integer for transfers' },
        { status: 400 }
      )
    }
  } else {
    const wt = body.weight_lbs
    if (wt === undefined || wt === 0 || isNaN(Number(wt))) {
      return NextResponse.json(
        { error: 'weight_lbs must be a non-zero number' },
        { status: 400 }
      )
    }
  }

  const supabase = createServerSupabaseClient()

  // Fetch the lot
  const { data: lot, error: fetchErr } = await supabase
    .from('green_lots')
    .select('id, total_weight_lbs, bag_count, bags_at_warehouse, bags_at_roastery, status')
    .eq('id', lotId)
    .single()

  if (fetchErr || !lot) {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }

  let updatedLot: typeof lot

  if (type === 'transferred') {
    // ── Transfer: move bags between warehouse and roastery ──────────────────
    const bags = Number(body.bag_count)  // positive = WH→Roastery, negative = R→WH

    const newAtWarehouse = Number(lot.bags_at_warehouse) - bags
    const newAtRoastery  = Number(lot.bags_at_roastery)  + bags

    if (newAtWarehouse < 0) {
      return NextResponse.json(
        { error: `Not enough bags at warehouse (have ${lot.bags_at_warehouse}, transferring ${bags})` },
        { status: 400 }
      )
    }
    if (newAtRoastery < 0) {
      return NextResponse.json(
        { error: `Not enough bags at roastery (have ${lot.bags_at_roastery}, transferring ${Math.abs(bags)})` },
        { status: 400 }
      )
    }

    const { data: updated, error: updateErr } = await supabase
      .from('green_lots')
      .update({ bags_at_warehouse: newAtWarehouse, bags_at_roastery: newAtRoastery })
      .eq('id', lotId)
      .select()
      .single()

    if (updateErr) {
      console.error('green_lots transfer update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
    updatedLot = updated

  } else {
    // ── Weight change: received / roasted / adjustment ──────────────────────
    const wt = Number(body.weight_lbs)
    const newTotal = Number(lot.total_weight_lbs) + wt

    const { data: updated, error: updateErr } = await supabase
      .from('green_lots')
      .update({ total_weight_lbs: newTotal })
      .eq('id', lotId)
      .select()
      .single()

    if (updateErr) {
      console.error('green_lots update error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
    updatedLot = updated
  }

  // Insert the transaction record
  const { data: transaction, error: txErr } = await supabase
    .from('green_lot_transactions')
    .insert({
      green_lot_id:  lotId,
      type,
      weight_lbs:    type === 'transferred' ? 0 : Number(body.weight_lbs),
      bag_count:     type === 'transferred' ? Number(body.bag_count) : null,
      location_from: body.location_from ?? null,
      location_to:   body.location_to   ?? null,
      notes:         body.notes         ?? null,
    })
    .select()
    .single()

  if (txErr) {
    console.error('green_lot_transactions insert error:', txErr)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  return NextResponse.json({ lot: updatedLot, transaction }, { status: 201 })
}
