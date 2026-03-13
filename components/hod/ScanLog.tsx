'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ScanEntry {
  id: string
  scan_type: 'exit' | 'reentry'
  scanned_at: string
  leave_request_id: string
  faculty_name: string
  faculty_id_code: string | null
  leave_type: string
  // paired data
  paired_time: string | null  // exit's paired reentry or reentry's paired exit
  duration_mins: number | null
}

function fmtTime(dt: string) {
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function fmtDuration(mins: number | null) {
  if (mins === null) return null
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    personal: 'Personal', medical: 'Medical', emergency: 'Emergency',
    official: 'Official', other: 'Other',
  }
  return map[type] || type
}

export default function ScanLog({ refreshKey }: { refreshKey?: number }) {
  const supabase = createClient()
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    setLoading(true)

    // Fetch last 20 scans — use FK hints to resolve ambiguous relationships
    // qr_scan_logs has two FKs to profiles (faculty_id + scanned_by_hod)
    const { data: logs, error: logsError } = await supabase
      .from('qr_scan_logs')
      .select('*, profiles!faculty_id(*), leave_requests(leave_type, approved_at, reason)')
      .order('scanned_at', { ascending: false })
      .limit(20)

    if (logsError) console.error('ScanLog fetch error:', logsError.message)

    if (!logs || logsError) { setLoading(false); return }

    // Group by leave_request_id to find exit+reentry pairs
    const grouped: Record<string, any[]> = {}
    for (const log of logs) {
      if (!grouped[log.leave_request_id]) grouped[log.leave_request_id] = []
      grouped[log.leave_request_id].push(log)
    }

    const result: ScanEntry[] = logs.map(log => {
      const siblings = grouped[log.leave_request_id] || []
      const exitLog = siblings.find((s: any) => s.scan_type === 'exit')
      const reentryLog = siblings.find((s: any) => s.scan_type === 'reentry')

      let duration_mins: number | null = null
      // Duration = from approval time (leave start) to reentry scan
      const leaveReq = (log as any).leave_requests
      if (leaveReq?.approved_at && reentryLog) {
        duration_mins = (new Date(reentryLog.scanned_at).getTime() - new Date(leaveReq.approved_at).getTime()) / 60000
      }

      const paired_time = log.scan_type === 'exit'
        ? (reentryLog ? fmtTime(reentryLog.scanned_at) : null)
        : (exitLog ? fmtTime(exitLog.scanned_at) : leaveReq?.approved_at ? fmtTime(leaveReq.approved_at) : null)

      return {
        id: log.id,
        scan_type: log.scan_type,
        scanned_at: log.scanned_at,
        leave_request_id: log.leave_request_id,
        faculty_name: (log as any).profiles?.full_name || '—',
        faculty_id_code: (log as any).profiles?.faculty_id || null,
        leave_type: leaveReq?.leave_type || '',
        paired_time,
        duration_mins: log.scan_type === 'reentry' ? duration_mins : null,
      }
    })

    setEntries(result)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchLogs() }, [fetchLogs, refreshKey])

  return (
    <div>
      <h3 className="text-sm font-bold mb-3">Scan History (last 20)</h3>
      <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Scan Time</th>
                <th className="px-3 py-2">Exit Time</th>
                <th className="px-3 py-2">Re-entry Time</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">Loading...</td>
                </tr>
              )}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-400">No scans yet</td>
                </tr>
              )}
              {entries.map(entry => {
                const dur = fmtDuration(entry.duration_mins)
                const exceeded = entry.duration_mins !== null && entry.duration_mins > 60
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-medium">{entry.faculty_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{entry.faculty_id_code || '—'}</td>
                    <td className="px-3 py-2.5">
                      {entry.scan_type === 'exit' ? (
                        <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold">EXIT</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold">ENTRY</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(entry.scanned_at)}</td>
                    <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium whitespace-nowrap">
                      {fmtTime(entry.scanned_at)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {entry.scan_type === 'exit'
                        ? <span className="font-medium text-orange-600">{fmtTime(entry.scanned_at)}</span>
                        : entry.paired_time
                          ? <span className="text-orange-600">{entry.paired_time}</span>
                          : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {entry.scan_type === 'reentry'
                        ? <span className="font-medium text-green-600">{fmtTime(entry.scanned_at)}</span>
                        : entry.paired_time
                          ? <span className="text-green-600">{entry.paired_time}</span>
                          : <span className="text-amber-500 italic text-[10px]">Still out</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {dur ? (
                        <span className={`font-semibold ${exceeded ? 'text-red-600' : 'text-green-600'}`}>
                          {dur}
                          {exceeded && <span className="ml-1 text-[10px]">⚠</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{leaveTypeLabel(entry.leave_type)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
