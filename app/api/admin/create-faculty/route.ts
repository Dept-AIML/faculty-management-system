import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Verify requester is HOD
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hod') {
    return NextResponse.json({ error: 'Forbidden -- HOD only' }, { status: 403 })
  }

  const { email, password, fullName, facultyId, designation, role } = await req.json()

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'email, password, fullName are required' }, { status: 400 })
  }

  // Validate role -- only 'faculty' and 'hr' can be created this way
  const targetRole = role === 'hr' ? 'hr' : 'faculty'

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: targetRole },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update the auto-created profile with extra fields
  await supabaseAdmin.from('profiles').update({
    faculty_id: targetRole === 'faculty' ? (facultyId || null) : null,
    designation,
    full_name: fullName,
    role: targetRole,
  }).eq('id', data.user.id)

  return NextResponse.json({ success: true, userId: data.user.id, role: targetRole })
}
