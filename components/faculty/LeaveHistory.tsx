'use client'

import { useState } from 'react'
import { LeaveRequest } from '@/types'

interface LeaveHistoryProps {
  requests: LeaveRequest[]
}

const PAGE_SIZE = 5

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDurationDays(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days === 1 ? '1 Day' : `${days} Days`
}

function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    personal: 'Personal', medical: 'Medical', emergency: 'Emergency', official: 'Official', other: 'Other',
  }
  return map[type] || type
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-400">Approved</span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">Rejected</span>
  )
  return (
    <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">Pending</span>
  )
}

export default function LeaveHistory({ requests }: LeaveHistoryProps) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(requests.length / PAGE_SIZE)
  const paged = requests.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <section className="px-4 py-2">
      <h3 className="mb-3 text-lg font-bold">Leave History</h3>
      <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400 text-sm">No leave requests yet</td>
                </tr>
              )}
              {paged.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{formatDate(r.start_datetime)}</p>
                    <p className="text-[10px] text-slate-400">{getDurationDays(r.start_datetime, r.end_datetime)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {leaveTypeLabel(r.leave_type)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="text-xs text-primary font-bold disabled:opacity-30"
            >
              &larr; Prev
            </button>
            <span className="text-xs text-slate-400">Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="text-xs text-primary font-bold disabled:opacity-30"
            >
              Next &rarr;
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
