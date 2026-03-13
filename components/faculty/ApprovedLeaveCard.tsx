'use client'

import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Modal from '@/components/ui/Modal'
import { LeaveRequest } from '@/types'
import { buildQRPayload } from '@/lib/qr'

interface ApprovedLeaveCardProps {
  leave: LeaveRequest
  facultyName: string
  facultyIdCode: string
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit' }
  return `${s.toLocaleDateString('en-US', opts).toUpperCase()} - ${e.toLocaleDateString('en-US', opts).toUpperCase()}`
}

function getDurationDays(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days === 1 ? '1 Day' : `${days} Days`
}

function leaveTypeLabel(type: string) {
  const map: Record<string, string> = {
    personal: 'Personal Leave',
    medical: 'Medical Leave',
    emergency: 'Emergency Leave',
    official: 'On Duty / Official',
    other: 'Other',
  }
  return map[type] || type
}

export default function ApprovedLeaveCard({ leave, facultyName, facultyIdCode }: ApprovedLeaveCardProps) {
  const [showQR, setShowQR] = useState(false)
  const qrWrapRef = useRef<HTMLDivElement>(null)

  const qrPayload = buildQRPayload({
    leaveId: leave.id,
    facultyId: leave.faculty_id,
    facultyName,
    facultyIdCode,
    approvedAt: leave.approved_at || '',
    leaveType: leave.leave_type,
    qrToken: leave.qr_token || '',
  })

  const handleDownload = useCallback(() => {
    const svg = qrWrapRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    canvas.width = 220
    canvas.height = 220
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, 220, 220)
      ctx.drawImage(img, 10, 10, 200, 200)
      const link = document.createElement('a')
      link.download = `leave-qr-${leave.id.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }, [leave.id])

  return (
    <>
      <div className="min-w-[280px] rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border-l-4 border-l-green-500 border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold text-slate-400">
            {formatDateRange(leave.start_datetime, leave.end_datetime)}
          </span>
          <span className="material-symbols-outlined text-green-500 text-lg">verified</span>
        </div>
        <h4 className="font-bold text-slate-900 dark:text-white">{leaveTypeLabel(leave.leave_type)}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Duration: {getDurationDays(leave.start_datetime, leave.end_datetime)}
        </p>
        {leave.qr_token ? (
          <button
            onClick={() => setShowQR(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-800 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">qr_code_2</span>
            View QR Code
          </button>
        ) : (
          <p className="text-xs text-slate-400 text-center py-2">QR pending HOD approval</p>
        )}
      </div>

      {/* QR Modal */}
      <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Leave Gate Pass QR">
        <div className="flex flex-col items-center gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Show this QR to HOD when returning
          </p>

          <div ref={qrWrapRef} className="p-4 bg-white rounded-xl border-2 border-primary/20 shadow-inner">
            <QRCodeSVG
              value={qrPayload}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="text-center text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200">{facultyName}</p>
            <p>{facultyIdCode} · {leaveTypeLabel(leave.leave_type)}</p>
            <p>{formatDateRange(leave.start_datetime, leave.end_datetime)}</p>
          </div>

          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download QR
          </button>
        </div>
      </Modal>
    </>
  )
}
