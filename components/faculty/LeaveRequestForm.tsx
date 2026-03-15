'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LeaveRequestFormProps {
  facultyId: string
  onSuccess?: () => void
}

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'personal', label: 'Personal Leave' },
  { value: 'medical', label: 'Medical Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'official', label: 'On Duty / Official' },
  { value: 'other', label: 'Other' },
]

export default function LeaveRequestForm({ facultyId, onSuccess }: LeaveRequestFormProps) {
  const supabase = createClient()
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    setLoading(true)

    const now = new Date().toISOString()

    const { error } = await supabase.from('leave_requests').insert({
      faculty_id: facultyId,
      leave_type: 'other',          // default; no longer shown to faculty
      start_datetime: now,          // submission time = leave start
      end_datetime: now,            // HOD approval triggers actual leave start
      reason: reason.trim(),
      status: 'pending',
    })

    setLoading(false)

    if (error) {
      showToast('error', error.message)
    } else {
      // Fetch the faculty's own profile to get name/id/designation for the email
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, faculty_id, designation')
        .eq('id', facultyId)
        .single()

      // Fire-and-forget — don't block the UI on email delivery
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:         'new_request',
          facultyName:   profile?.full_name   ?? 'Faculty',
          facultyIdCode: profile?.faculty_id  ?? '',
          designation:   profile?.designation ?? '',
          reason:        reason.trim(),
          submittedAt:   now,
        }),
      }).catch((err) => console.warn('[notify] HOD email skipped:', err))

      showToast('success', 'Leave request submitted! Awaiting HOD approval.')
      setReason('')
      onSuccess?.()
    }
  }

  return (
    <section className="px-4 py-2">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <h3 className="mb-3 text-lg font-bold">New Leave Request</h3>
      <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-100 dark:border-slate-800">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason for Leave
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly explain why you need to leave..."
              rows={4}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm px-3 py-2"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Submitted: {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !reason.trim()}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </>
            ) : 'Submit Request'}
          </button>
        </form>
      </div>
    </section>
  )
}
