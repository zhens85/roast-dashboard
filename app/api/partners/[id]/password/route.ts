import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('roast_session')?.value === 'authenticated'
}

// PATCH /api/partners/[id]/password — set a new password for a partner account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: partnerId } = await params

  let newPassword: string
  try {
    const body = await request.json()
    if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }
    newPassword = body.password
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { error } = await supabase.auth.admin.updateUserById(partnerId, {
    password: newPassword,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
