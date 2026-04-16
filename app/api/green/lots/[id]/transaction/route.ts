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

// POST /api/green/lots/[id]/transaction — log a weight change
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const lotId = parseInt(id, 10)
  if (isNaN(lotId)) return NextResponse.json({ error: 'Invalid lot id' }, { status: 400 })

  let body: {
    type: 'received' | 'transferred' | 'roasted' | 'adjustment'
    weight_lbs: number
    location_from?: string | null
    location_to?: string | null
    notes?: string | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type, weight_lbs } = body

  const validTypes = ['received', 'transferred', 'roasted', 'adjustment']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 })
  }
  if (weight_lbs === undefined || weight_lbs === 0 || isNaN(Number(weight_lbs))) {
    return NextResponse.json({ error: 'weight_lbs must be a non-zero number' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Verify the lot exists
  const { data: lot, error: fetchErr } = await supabase
    .from('green_lots')
    .select('id, total_weight_lbs, status')
    .eq('id', lotId)
    .single()

  if (fetchErr || !lot) {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }

  const newTotal = Number(lot.total_weight_lbs) + Number(weight_lbs)

  // Update the lot's total weight
  const { data: updatedLot, error: updateErr } = await supabase
    .from('green_lots')
    .update({ total_weight_lbs: newTotal })
    .eq('id', lotId)
    .select()
    .single()

  if (updateErr) {
    console.error('green_lots update error:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Insert the transaction record
  const { data: transaction, error: txErr } = await supabase
    .from('green_lot_transactions')
    .insert({
      green_lot_id:  lotId,
      type,
      weight_lbs:    Number(weight_lbs),
      location_from: body.location_from ?? null,
      location_to:   body.location_to ?? null,
      notes:         body.notes ?? null,
    })
    .select()
    .single()

  if (txErr) {
    console.error('green_lot_transactions insert error:', txErr)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  return NextResponse.json({ lot: updatedLot, transaction }, { status: 201 })
}
