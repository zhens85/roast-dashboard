import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// POST /api/green/lots/[id]/archive — set status = 'archived'
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const lotId = parseInt(id, 10)
  if (isNaN(lotId)) return NextResponse.json({ error: 'Invalid lot id' }, { status: 400 })

  const supabase = createServerSupabaseClient()

  // Verify the lot exists
  const { data: existing, error: fetchErr } = await supabase
    .from('green_lots')
    .select('id, status')
    .eq('id', lotId)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Lot not found' }, { status: 404 })
  }

  if (existing.status === 'archived') {
    return NextResponse.json({ error: 'Lot is already archived' }, { status: 409 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('green_lots')
    .update({ status: 'archived' })
    .eq('id', lotId)
    .select()
    .single()

  if (updateErr) {
    console.error('green_lots archive error:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
