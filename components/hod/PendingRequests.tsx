'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LeaveRequest, Profile } from '@/types'
import Modal from '@/components/ui/Modal'
import { v4 as uuidv4 } from 'uuid'

interface PendingRequestsProps {
  hodId: string
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getDurationDays(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days === 1 ? '1 Day' : `${days} Days`
}

function timeAgo(dt: string) {
  const diff = Date.now() - new Date(dt).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function leaveTypeBadge(type: string) {
  const map: Record<string, string> = {
    personal: 'bg-blue-100 text-blue-700', medical: 'bg-purple-100 text-purple-700',
    emergency: 'bg-red-100 text-red-700', official: 'bg-green-100 text-green-700', other: 'bg-slate-100 text-slate-700'
  }
  const label: Record<string, string> = {
    personal: 'Personal', medical: 'Medical', emergency: 'Emergency', official: 'Official', other: 'Other'
  }
  return { className: map[type] || 'bg-slate-100 text-slate-600', label: label[type] || type }
}

type Filter = 'all' | 'pending' | 'approved' | 'rejected'

export default function PendingRequests({ hodId }: PendingRequestsProps) {
  const supabase = createClient()
  const [requests, setRequests] = useState<(LeaveRequest & { profiles: Profile })[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; leaveId: string }>({ open: false, leaveId: '' })
  const [remarks, setRemarks] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/hod/leave-requests')
      if (!res.ok) {
        const { error } = await res.json()
        console.error('Fetch error:', error)
        setLoading(false)
        return
      }
      const { data } = await res.json()
      setRequests(data || [])
    } catch (err) {
      console.error('Fetch exception:', err)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
    const channel = supabase
      .channel('leave_requests_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchRequests()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchRequests, supabase])

  const handleApprove = async (leaveId: string) => {
    const qrToken = uuidv4()
    const now = new Date().toISOString()

    const { error } = await supabase.from('leave_requests').update({
      status: 'approved',
      approved_by: hodId,
      approved_at: now,
      start_datetime: now,        // leave starts at moment of approval
      qr_token: qrToken,
      qr_generated_at: now,
      qr_used: false,             // fresh, unused QR
    }).eq('id', leaveId)

    if (error) showToast('error', error.message)
    else { showToast('success', 'Leave approved! QR code generated.'); fetchRequests() }
  }

  const handleReject = async () => {
    const { error } = await supabase.from('leave_requests').update({
      status: 'rejected',
      hod_remarks: remarks,
    }).eq('id', rejectModal.leaveId)

    if (error) showToast('error', error.message)
    else {
      showToast('success', 'Leave rejected.')
      setRejectModal({ open: false, leaveId: '' })
      setRemarks('')
      fetchRequests()
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const approvedToday = requests.filter(r => {
    if (r.status !== 'approved') return false
    const d = new Date(r.approved_at || '')
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length
  const totalFaculty = new Set(requests.map(r => r.faculty_id)).size

  return (
    <div className="p-4 space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">{toast.type === 'success' ? 'check_circle' : 'error'}</span>
          {toast.msg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Pending', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved Today', value: approvedToday, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Faculty', value: totalFaculty, color: 'text-primary', bg: 'bg-primary/5' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-xl p-3 text-center border border-slate-100 dark:border-slate-800`}>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[9px] text-slate-500 font-medium mt-0.5 leading-tight">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-colors ${
              filter === f ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">
          {filter === 'pending' ? `Pending Approvals (${pendingCount})` : `${filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Requests (${filtered.length})`}
        </h3>
        <span className="text-xs text-slate-500 font-medium italic">Recent first</span>
      </div>

      {loading && <p className="text-center text-slate-400 text-sm py-8">Loading...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No {filter} requests</p>
      )}

      {/* Request Cards */}
      {filtered.map(req => {
        const { className: badgeClass, label: badgeLabel } = leaveTypeBadge(req.leave_type)
        const initials = req.profiles?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'F'

        return (
          <div key={req.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-bold">{req.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">ID: {req.profiles?.faculty_id || 'N/A'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase">{timeAgo(req.created_at)}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>{badgeLabel}</span>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5">info</span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Reason:</span> {req.reason}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5">calendar_month</span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Date:</span> {formatDate(req.start_datetime)} – {formatDate(req.end_datetime)} ({getDurationDays(req.start_datetime, req.end_datetime)})
                </p>
              </div>
              {req.hod_remarks && (
                <div className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm mt-0.5">comment</span>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Remarks:</span> {req.hod_remarks}
                  </p>
                </div>
              )}
            </div>

            {req.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectModal({ open: true, leaveId: req.id })}
                  className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(req.id)}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                >
                  Approve
                </button>
              </div>
            )}

            {req.status === 'approved' && (
              <div className="flex items-center gap-1 text-green-600 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Approved {req.approved_at ? formatDate(req.approved_at) : ''}
              </div>
            )}

            {req.status === 'rejected' && (
              <div className="flex items-center gap-1 text-red-600 text-xs font-bold">
                <span className="material-symbols-outlined text-sm">cancel</span>
                Rejected
              </div>
            )}
          </div>
        )
      })}

      {/* Reject Modal */}
      <Modal isOpen={rejectModal.open} onClose={() => setRejectModal({ open: false, leaveId: '' })} title="Reject Leave Request">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">Please provide a reason for rejection:</p>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Rejection reason..."
            rows={3}
            className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:border-primary focus:ring-primary text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setRejectModal({ open: false, leaveId: '' })}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!remarks.trim()}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
