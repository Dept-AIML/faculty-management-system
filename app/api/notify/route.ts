import { NextRequest, NextResponse } from 'next/server'
import { newRequestEmail, approvedEmail, rejectedEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

// ─── Resend sender & recipient config ────────────────────────────────────────
const FROM    = 'CMRTC Gate Pass <noreply@cmrtcgatepass.in>'
const HOD_TO  = process.env.HOD_EMAIL!
const SITE    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.cmrtcgatepass.in'

// ─── Shared Resend helper ─────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

// ─── Webhook secret guard — only for status_change (DB trigger calls) ────────
function authorisedWebhook(req: NextRequest): boolean {
  const secret = process.env.NOTIFY_WEBHOOK_SECRET
  if (!secret) return true   // no secret configured → open (dev/test)
  return req.headers.get('x-webhook-secret') === secret
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notify
//
// Two event types:
//
//  1. "new_request"  — called by LeaveRequestForm (frontend, no secret needed)
//     Body: { event, facultyName, facultyIdCode, designation, reason, submittedAt }
//
//  2. "status_change" — called by Supabase pg_net trigger (must include secret)
//     Body: { event, status, facultyEmail, facultyName, reason, hodRemarks, approvedAt }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[notify] RESEND_API_KEY not set')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { event } = body

  // ── Event 1: new request → notify HOD ─────────────────────────────────────
  // Called directly from the browser — no webhook secret required.
  if (event === 'new_request') {
    const { facultyName, facultyIdCode, designation, reason, submittedAt } = body

    if (!facultyName || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { subject, html } = newRequestEmail({
      facultyName,
      facultyIdCode: facultyIdCode || 'N/A',
      designation:   designation   || 'Faculty',
      reason,
      submittedAt: submittedAt ? formatDateTime(submittedAt) : formatDateTime(new Date().toISOString()),
      dashboardUrl: `${SITE}/hod`,
    })

    try {
      await sendEmail(HOD_TO, subject, html)
      return NextResponse.json({ ok: true, sent_to: 'hod' })
    } catch (err) {
      console.error('[notify] new_request email failed:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }
  }

  // ── Event 2: status change → notify faculty ────────────────────────────────
  // Called by Supabase pg_net trigger — webhook secret is required.
  if (event === 'status_change') {
    if (!authorisedWebhook(req)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status, facultyEmail, facultyName, reason, hodRemarks, approvedAt } = body

    if (!facultyEmail || !facultyName || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let subject: string
    let html: string

    if (status === 'approved') {
      ;({ subject, html } = approvedEmail({
        facultyName,
        reason: reason || '',
        approvedAt: approvedAt ? formatDateTime(approvedAt) : formatDateTime(new Date().toISOString()),
        dashboardUrl: `${SITE}/faculty`,
      }))
    } else if (status === 'rejected') {
      ;({ subject, html } = rejectedEmail({
        facultyName,
        reason:     reason     || '',
        hodRemarks: hodRemarks || '',
        dashboardUrl: `${SITE}/faculty`,
      }))
    } else {
      return NextResponse.json({ error: `Unknown status: ${status}` }, { status: 400 })
    }

    try {
      await sendEmail(facultyEmail, subject, html)
      return NextResponse.json({ ok: true, sent_to: 'faculty', status })
    } catch (err) {
      console.error('[notify] status_change email failed:', err)
      return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
}
