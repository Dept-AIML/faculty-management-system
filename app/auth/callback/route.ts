import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/auth/reset-password'

  if (!code) {
    // No code — malformed or expired link, send to login with an error flag
    return NextResponse.redirect(
      new URL('/login?error=invalid_reset_link', request.url)
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Exchange failed — link likely expired (default is 1 hour)
    return NextResponse.redirect(
      new URL('/login?error=expired_reset_link', request.url)
    )
  }

  // Session established — redirect to the reset password page
  return NextResponse.redirect(new URL(next, request.url))
}
