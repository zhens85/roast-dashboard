import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin', request.url), {
    status: 303,
  })
  response.cookies.delete('roast_session')
  return response
}
