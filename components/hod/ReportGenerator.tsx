'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Generate available {month, year} pairs from March 2026 up to today */
function getAvailableMonths(): { month: number; year: number; label: string }[] {
  const start = new Date(2026, 2, 1) // March 2026
  const now = new Date()
  const result: { month: number; year: number; label: string }[] = []

  const cursor = new Date(start)
  while (
    cursor.getFullYear() < now.getFullYear() ||
    (cursor.getFullYear() === now.getFullYear() && cursor.getMonth() <= now.getMonth())
  ) {
    result.push({
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
      label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return result.reverse() // Most recent first
}

interface FacultyLeaveDetail {
  facultyId: string
  fullName: string
  email: string
  designation: string
  leaves: {
    date: string
    reason: string
    approvedAt: string
    exitTime: string | null
    reentryTime: string | null
    durationMins: number | null
    exceededLimit: boolean
  }[]
}

function fmt(dt: string | null, mode: 'date' | 'time' = 'time') {
  if (!dt) return null
  const d = new Date(dt)
  if (mode === 'date') return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDuration(mins: number | null) {
  if (mins === null) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function ReportGenerator() {
  const supabase = createClient()
  const availableMonths = getAvailableMonths()

  // Default to the most recent available month
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<FacultyLeaveDetail[] | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const selected = availableMonths[selectedIndex]

  const fetchReportData = useCallback(async () => {
    if (!selected) return null
    const { month, year } = selected
    const startDate = new Date(year, month, 1).toISOString()
    const endDate   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    // leave_requests has two FKs to profiles (faculty_id + approved_by) — use hint
    const { data: leaves, error } = await supabase
      .from('leave_requests')
      .select('*, profiles!faculty_id(*)')
      .eq('status', 'approved')
      .gte('approved_at', startDate)
      .lte('approved_at', endDate)
      .order('approved_at', { ascending: true })

    if (error) {
      console.error('Report fetch error:', error.message)
      return null
    }
    if (!leaves) return []

    const facultyMap: Record<string, FacultyLeaveDetail> = {}

    for (const leave of leaves) {
      const fid = leave.faculty_id
      const profile = (leave as any).profiles

      if (!facultyMap[fid]) {
        facultyMap[fid] = {
          facultyId: profile?.faculty_id || 'N/A',
          fullName: profile?.full_name || 'Unknown',
          email: profile?.email || '',
          designation: profile?.designation || '',
          leaves: [],
        }
      }

      const { data: scanLogs } = await supabase
        .from('qr_scan_logs')
        .select('*')
        .eq('leave_request_id', leave.id)
        .order('scanned_at', { ascending: true })

      const exitLog    = scanLogs?.find(s => s.scan_type === 'exit')    || null
      const reentryLog = scanLogs?.find(s => s.scan_type === 'reentry') || null

      let durationMins: number | null = null
      let exceededLimit = false

      if (leave.approved_at && reentryLog?.scanned_at) {
        durationMins = (new Date(reentryLog.scanned_at).getTime() - new Date(leave.approved_at).getTime()) / 60000
        exceededLimit = durationMins > 60
      }

      facultyMap[fid].leaves.push({
        date:        fmt(leave.approved_at, 'date') || '—',
        reason:      leave.reason,
        approvedAt:  fmt(leave.approved_at, 'time') || '—',
        exitTime:    exitLog    ? fmt(exitLog.scanned_at,    'time') : fmt(leave.approved_at, 'time'),
        reentryTime: reentryLog ? fmt(reentryLog.scanned_at, 'time') : null,
        durationMins,
        exceededLimit,
      })
    }

    return Object.values(facultyMap)
  }, [selected, supabase])

  const generateReport = useCallback(async () => {
    setLoading(true)
    setReportData(null)
    setFetchError(null)

    const data = await fetchReportData()
    if (data === null) {
      setFetchError('Failed to fetch report data. Please check your connection and try again.')
      setLoading(false)
      return
    }

    setReportData(data)
    setLoading(false)
  }, [fetchReportData])

  // ── PDF download ────────────────────────────────────────────────────────────
  const downloadPDF = useCallback(async (data: FacultyLeaveDetail[]) => {
    if (!selected) return
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape' })
    const monthLabel = selected.label
    const pageW = doc.internal.pageSize.width

    doc.setFontSize(16)
    doc.setTextColor('#ec5b13')
    doc.text('CMR Technical Campus', pageW / 2, 16, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor('#000000')
    doc.text('CSE (AI & ML) — Faculty Permission / Leave Report', pageW / 2, 24, { align: 'center' })
    doc.setFontSize(9)
    doc.setTextColor('#666666')
    doc.text(`Period: ${monthLabel}   |   Generated: ${new Date().toLocaleString('en-IN')}`, pageW / 2, 30, { align: 'center' })

    let startY = 38
    let totalLeaves = 0
    let totalExceeded = 0

    for (const faculty of data) {
      if (faculty.leaves.length === 0) continue
      totalLeaves   += faculty.leaves.length
      const exceeded = faculty.leaves.filter(l => l.exceededLimit).length
      totalExceeded += exceeded

      doc.setFontSize(10)
      doc.setTextColor('#ec5b13')
      doc.text(
        `${faculty.fullName}  (${faculty.facultyId})${faculty.designation ? '  —  ' + faculty.designation : ''}`,
        14, startY
      )
      doc.setFontSize(8)
      doc.setTextColor('#555555')
      doc.text(
        `${faculty.email}   |   Total: ${faculty.leaves.length} permission(s)   |   Exceeded 1hr: ${exceeded}`,
        14, startY + 4
      )

      autoTable(doc, {
        startY: startY + 8,
        head: [['Date', 'Reason', 'Approved At', 'Exit Time', 'Re-entry Time', 'Duration', 'Status']],
        body: faculty.leaves.map(l => [
          l.date,
          l.reason.length > 42 ? l.reason.slice(0, 42) + '…' : l.reason,
          l.approvedAt,
          l.exitTime    || '—',
          l.reentryTime || 'Still out',
          fmtDuration(l.durationMins),
          l.reentryTime ? (l.exceededLimit ? 'EXCEEDED' : 'ON TIME') : 'PENDING',
        ]),
        headStyles:          { fillColor: [236, 91, 19], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        bodyStyles:          { fontSize: 7.5 },
        alternateRowStyles:  { fillColor: [255, 248, 245] },
        columnStyles:        { 1: { cellWidth: 58 } },
        didParseCell: (cellData: any) => {
          if (cellData.section === 'body' && cellData.column.index === 6) {
            const val = String(cellData.cell.raw)
            if      (val === 'EXCEEDED') cellData.cell.styles.textColor = [200, 30,  30]
            else if (val === 'ON TIME')  cellData.cell.styles.textColor = [20,  150, 80]
            else                         cellData.cell.styles.textColor = [180, 120, 0]
          }
        },
        margin: { left: 14, right: 14 },
      })

      startY = (doc as any).lastAutoTable.finalY + 12
      if (startY > doc.internal.pageSize.height - 30) {
        doc.addPage()
        startY = 20
      }
    }

    doc.setFontSize(9)
    doc.setTextColor('#333333')
    doc.text(
      `Summary — Faculty: ${data.length}  |  Total Permissions: ${totalLeaves}  |  Exceeded 1hr Limit: ${totalExceeded}`,
      14, Math.min(startY + 4, doc.internal.pageSize.height - 10)
    )

    doc.save(`Leave_Report_${monthLabel.replace(' ', '_')}.pdf`)
  }, [selected])

  // ── CSV download ─────────────────────────────────────────────────────────────
  const downloadCSV = useCallback((data: FacultyLeaveDetail[]) => {
    if (!selected) return
    const rows: string[][] = []
    rows.push([
      'Faculty Name', 'Faculty ID', 'Designation', 'Email',
      'Date', 'Reason', 'Approved At', 'Exit Time',
      'Re-entry Time', 'Duration', 'Status',
    ])

    for (const faculty of data) {
      for (const l of faculty.leaves) {
        rows.push([
          faculty.fullName,
          faculty.facultyId,
          faculty.designation,
          faculty.email,
          l.date,
          l.reason.replace(/,/g, ';'),
          l.approvedAt,
          l.exitTime    || '—',
          l.reentryTime || 'Still out',
          fmtDuration(l.durationMins),
          l.reentryTime ? (l.exceededLimit ? 'EXCEEDED' : 'ON TIME') : 'PENDING',
        ])
      }
    }

    const csv     = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url     = URL.createObjectURL(blob)
    const link    = document.createElement('a')
    link.href     = url
    link.download = `Leave_Report_${selected.label.replace(' ', '_')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [selected])

  const monthLabel    = selected?.label ?? ''
  const totalLeaves   = reportData?.reduce((a, f) => a + f.leaves.length, 0)               ?? 0
  const totalExceeded = reportData?.reduce((a, f) => a + f.leaves.filter(l => l.exceededLimit).length, 0) ?? 0

  return (
    <div className="p-4 space-y-4">
      {/* ── Controls ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">analytics</span>
          Department Reports
        </h3>

        {availableMonths.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-2">No report periods available yet.</p>
        ) : (
          <>
            <select
              value={selectedIndex}
              onChange={(e) => { setSelectedIndex(Number(e.target.value)); setReportData(null) }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium px-3 py-2 mb-4 focus:ring-primary focus:border-primary"
            >
              {availableMonths.map((m, i) => (
                <option key={`${m.year}-${m.month}`} value={i}>{m.label}</option>
              ))}
            </select>

            <button
              onClick={generateReport}
              disabled={loading}
              className="w-full bg-primary/10 text-primary py-2.5 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">summarize</span>
                  Generate Report — {monthLabel}
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Error ── */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
          <span>{fetchError}</span>
        </div>
      )}

      {/* ── Summary cards ── */}
      {reportData && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Faculty',            value: reportData.length, color: 'text-primary',   bg: 'bg-primary/5'  },
            { label: 'Total Permissions',  value: totalLeaves,       color: 'text-green-600', bg: 'bg-green-50'   },
            { label: 'Exceeded 1hr',       value: totalExceeded,     color: 'text-red-600',   bg: 'bg-red-50'     },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center border border-slate-100`}>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-[9px] text-slate-500 font-medium mt-0.5 leading-tight">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {reportData && reportData.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-8">No approved permissions for {monthLabel}</p>
      )}

      {/* ── Download buttons ── */}
      {reportData && reportData.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => downloadPDF(reportData)}
            className="border-2 border-dashed border-primary/30 py-3 rounded-xl text-xs font-semibold text-primary flex items-center justify-center gap-2 hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            Download PDF
          </button>
          <button
            onClick={() => downloadCSV(reportData)}
            className="border-2 border-dashed border-green-400/40 py-3 rounded-xl text-xs font-semibold text-green-600 flex items-center justify-center gap-2 hover:border-green-500/60 hover:bg-green-50 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">table_view</span>
            Download CSV
          </button>
        </div>
      )}

      {/* ── Per-faculty tables ── */}
      {reportData && reportData.map(faculty => (
        <div key={faculty.facultyId} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{faculty.fullName}</p>
              <p className="text-[10px] text-slate-500">{faculty.facultyId}{faculty.designation && ` · ${faculty.designation}`}</p>
            </div>
            <div className="flex gap-2">
              <span className="flex flex-col items-center bg-primary/10 text-primary rounded-lg px-2.5 py-1">
                <span className="text-lg font-bold leading-none">{faculty.leaves.length}</span>
                <span className="text-[9px] font-medium">leaves</span>
              </span>
              {faculty.leaves.filter(l => l.exceededLimit).length > 0 && (
                <span className="flex flex-col items-center bg-red-50 text-red-600 rounded-lg px-2.5 py-1">
                  <span className="text-lg font-bold leading-none">{faculty.leaves.filter(l => l.exceededLimit).length}</span>
                  <span className="text-[9px] font-medium">exceeded</span>
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 uppercase font-bold">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Approved</th>
                  <th className="px-3 py-2 text-left">Exit</th>
                  <th className="px-3 py-2 text-left">Re-entry</th>
                  <th className="px-3 py-2 text-left">Duration</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {faculty.leaves.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{l.date}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300 max-w-[160px]">
                      <span className="block truncate" title={l.reason}>{l.reason}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{l.approvedAt}</td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{l.exitTime || '—'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {l.reentryTime
                        ? <span className="text-green-600 font-medium">{l.reentryTime}</span>
                        : <span className="text-amber-500 font-medium italic">Still out</span>}
                    </td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      <span className={l.exceededLimit ? 'text-red-600' : l.durationMins !== null ? 'text-green-600' : 'text-slate-400'}>
                        {fmtDuration(l.durationMins)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {l.reentryTime
                        ? l.exceededLimit
                          ? <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold text-[10px]">EXCEEDED</span>
                          : <span className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold text-[10px]">ON TIME</span>
                        : <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold text-[10px]">PENDING</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
