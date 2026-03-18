import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Shared guard -- caller must be HOD
async function requireHOD() {
  // Guard: service role key must exist before doing anything
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY not set', status: 500 }
  }

  const supabase = await createServerSupabase()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Unauthorized', status: 401 }

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
export async function PATCH(req: NextRequest) {
  const ctx = await requireHOD()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { admin } = ctx

  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { targetId, action, role } = body
  if (!targetId || !action) {
    return NextResponse.json({ error: 'targetId and action are required' }, { status: 400 })
  }

  const { data: target, error: fetchErr } = await admin
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', targetId)
    .single()

  if (fetchErr || !target) {
    console.error('[manage-profile PATCH] fetch error:', fetchErr)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (target.role === 'hod') {
    return NextResponse.json({ error: 'Cannot modify another HOD account' }, { status: 403 })
  }

  if (action === 'toggle_active') {
    const { error } = await admin
      .from('profiles')
      .update({ is_active: !target.is_active })
      .eq('id', targetId)

    if (error) {
      console.error('[manage-profile PATCH toggle_active]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
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

    if (error) {
      console.error('[manage-profile PATCH set_role]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, role })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}

// -- DELETE: permanently delete a profile + auth user ---------------------
export async function DELETE(req: NextRequest) {
  const ctx = await requireHOD()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { admin } = ctx

  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { targetId } = body
  if (!targetId) {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
  }

  // Fetch target to safety-check role
  const { data: target, error: fetchErr } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', targetId)
    .single()

  if (fetchErr || !target) {
    console.error('[manage-profile DELETE] fetch error:', fetchErr)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  if (target.role === 'hod') {
    return NextResponse.json({ error: 'Cannot delete a HOD account' }, { status: 403 })
  }

  // Step 1: Delete the auth user (profiles row cascades via FK)
  const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(targetId)
  if (deleteAuthErr) {
    console.error('[manage-profile DELETE] auth.admin.deleteUser error:', deleteAuthErr)

    // Fallback: if auth delete fails, try deleting just the profile row directly
    // This handles edge cases where the auth user was already removed
    const { error: profileDeleteErr } = await admin
      .from('profiles')
      .delete()
      .eq('id', targetId)

    if (profileDeleteErr) {
      console.error('[manage-profile DELETE] profile fallback delete error:', profileDeleteErr)
      return NextResponse.json(
        { error: `Failed to delete account: ${deleteAuthErr.message}` },
        { status: 500 }
      )
    }
    // Profile row deleted even though auth delete failed -- still a success
    return NextResponse.json({ ok: true, deleted: targetId, note: 'profile removed, auth user may have already been deleted' })
  }

  return NextResponse.json({ ok: true, deleted: targetId })
}
