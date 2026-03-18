import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// -- Shared helper: get authed user + admin client -------------------------
async function getAuthContext() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized', status: 401 }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'hod' && profile.role !== 'hr')) {
    return { error: 'Forbidden -- HOD or HR only', status: 403 }
  }

  return { user, profile, admin }
}

// -- GET: fetch leave requests ---------------------------------------------
export async function GET() {
  const ctx = await getAuthContext()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { profile, admin } = ctx

  let query = admin
    .from('leave_requests')
    .select('*, profiles!faculty_id(*)')
    .order('created_at', { ascending: false })

  // HR sees all requests except their own (own leave status via faculty page)
  if (profile.role === 'hr') {
    query = query.neq('faculty_id', profile.id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// -- PATCH: approve or reject a leave request ------------------------------
export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext()
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const { profile, admin } = ctx

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { leaveId, action, remarks } = body

  if (!leaveId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'leaveId and action (approve|reject) are required' }, { status: 400 })
  }

  // Fetch the target leave request
  const { data: leave, error: fetchErr } = await admin
    .from('leave_requests')
    .select('id, faculty_id, status')
    .eq('id', leaveId)
    .single()

  if (fetchErr || !leave) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
  }

  // HR cannot approve/reject their own leave
  if (profile.role === 'hr' && leave.faculty_id === profile.id) {
    return NextResponse.json(
      { error: 'HR cannot approve or reject their own leave request' },
      { status: 403 }
    )
  }

  if (leave.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be actioned' }, { status: 409 })
  }

  // Build update payload
  const { v4: uuidv4 } = await import('uuid')
  const now = new Date().toISOString()

  const updatePayload =
    action === 'approve'
      ? {
          status: 'approved',
          approved_by: profile.id,
          approved_at: now,
          start_datetime: now,
          qr_token: uuidv4(),
          qr_generated_at: now,
          qr_used: false,
        }
      : {
          status: 'rejected',
          hod_remarks: remarks || '',
        }

  const { error: updateErr } = await admin
    .from('leave_requests')
    .update(updatePayload)
    .eq('id', leaveId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action, leaveId })
}
