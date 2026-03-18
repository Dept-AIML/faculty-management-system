import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Shared guard -- caller must be HOD
async function requireHOD() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'hod') return { error: 'Forbidden -- HOD only', status: 403 }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  return { admin, callerId: user.id }
}

// -- PATCH: toggle is_active OR change role --------------------------------
// Body: { targetId, action: 'toggle_active' | 'set_role', role?: 'faculty' | 'hr' }
export async function PATCH(req: NextRequest) {
  const ctx = await requireHOD()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { admin } = ctx

  const { targetId, action, role } = await req.json()
  if (!targetId || !action) {
    return NextResponse.json({ error: 'targetId and action are required' }, { status: 400 })
  }

  // Fetch current profile
  const { data: target, error: fetchErr } = await admin
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', targetId)
    .single()

  if (fetchErr || !target) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Prevent HOD from modifying another HOD
  if (target.role === 'hod') {
    return NextResponse.json({ error: 'Cannot modify another HOD account' }, { status: 403 })
  }

  if (action === 'toggle_active') {
    const { error } = await admin
      .from('profiles')
      .update({ is_active: !target.is_active })
      .eq('id', targetId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, is_active: !target.is_active })
  }

  if (action === 'set_role') {
    if (!role || !['faculty', 'hr'].includes(role)) {
      return NextResponse.json({ error: "role must be 'faculty' or 'hr'" }, { status: 400 })
    }
    const { error } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', targetId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, role })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}

// -- DELETE: permanently delete a profile + auth user ---------------------
// Body: { targetId }
export async function DELETE(req: NextRequest) {
  const ctx = await requireHOD()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { admin } = ctx

  const { targetId } = await req.json()
  if (!targetId) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
  }

  // Fetch target to safety-check role
  const { data: target } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', targetId)
    .single()

  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (target.role === 'hod') {
    return NextResponse.json({ error: 'Cannot delete a HOD account' }, { status: 403 })
  }

  // Delete auth user -- profiles row cascades automatically via FK
  const { error } = await admin.auth.admin.deleteUser(targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: targetId })
}
