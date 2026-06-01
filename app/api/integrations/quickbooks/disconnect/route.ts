import { NextRequest, NextResponse } from 'next/server'
import { deleteQBOCredentials } from '@/lib/quickbooks'

export async function POST(request: NextRequest) {
  if (request.cookies.get('roast_session')?.value !== 'authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await deleteQBOCredentials()
  return NextResponse.redirect(new URL('/admin/settings', request.url))
}
