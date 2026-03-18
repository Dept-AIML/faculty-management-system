'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseQRPayload } from '@/lib/qr'
import ScanLog from './ScanLog'

interface ScanResult {
  facultyName: string
  facultyIdCode: string
  scanType: 'exit' | 'reentry'
  scannedAt: string
  leaveType: string
}

interface QRScannerProps {
  hodId: string
  scannerRole?: 'hod' | 'hr'
}

export default function QRScanner({ hodId, scannerRole = 'hod' }: QRScannerProps) {
  const supabase = createClient()
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshLog, setRefreshLog] = useState(0)
  const html5QrRef = useRef<any>(null)

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop() } catch {}
      try { await html5QrRef.current.clear() } catch {}
      html5QrRef.current = null
    }
    setScanning(false)
  }, [])

  const processQR = useCallback(async (decodedText: string) => {
    await stopScanner()
    const payload = parseQRPayload(decodedText)
    if (!payload) {
      setError('Invalid QR code - not a valid leave pass.')
      return
    }

    // HR cannot scan their own return QR
    if (scannerRole === 'hr' && payload.facultyId === hodId) {
      setError('You cannot scan your own re-entry QR code. Please ask the HOD to scan it.')
      return
    }

    const { data: leave, error: lvErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', payload.leaveId)
      .eq('qr_token', payload.qrToken)
      .eq('status', 'approved')
      .eq('qr_used', false)
      .single()

    if (lvErr || !leave) {
      setError(leave === null ? 'QR code already used or invalid.' : 'Leave not found or not approved.')
      return
    }

    // Mark QR as used
    await supabase
      .from('leave_requests')
      .update({ qr_used: true })
      .eq('id', payload.leaveId)

    // Log re-entry scan
    await supabase.from('qr_scan_logs').insert({
      leave_request_id: payload.leaveId,
      faculty_id: payload.facultyId,
      scan_type: 'reentry',
      scanned_by_hod: hodId,
    })

    setScanResult({
      facultyName: payload.facultyName,
      facultyIdCode: payload.facultyIdCode,
      scanType: 'reentry',
      scannedAt: new Date().toLocaleString('en-IN'),
      leaveType: payload.leaveType,
    })
    setRefreshLog(p => p + 1)
  }, [supabase, hodId, scannerRole, stopScanner])

  const startScanner = useCallback(async () => {
    setError(null)
    setScanResult(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Use Chrome or Safari on a mobile device.')
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.')
      return
    }

    setScanning(true)

    const { Html5Qrcode } = await import('html5-qrcode')
    const qr = new Html5Qrcode('qr-reader-element')
    html5QrRef.current = qr

    try {
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        processQR,
        undefined
      )
    } catch (err: any) {
      setError(`Could not start camera: ${err?.message || err}`)
      setScanning(false)
    }
  }, [processQR])

  useEffect(() => {
    return () => { stopScanner() }
  }, [stopScanner])

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-base font-bold">QR Code Scanner</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scan faculty re-entry QR codes for gate verification
        </p>
      </div>

      {/* HR restriction notice */}
      {scannerRole === 'hr' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">info</span>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            You can scan re-entry QR codes for all faculty. Your own re-entry must be scanned by the HOD.
          </p>
        </div>
      )}

      {/* Scanner container */}
      <div className="rounded-2xl border-2 border-slate-800 bg-slate-900 relative min-h-[300px] flex flex-col items-center justify-center">
        <div
          id="qr-reader-element"
          className={`w-full ${scanning ? 'block' : 'hidden'}`}
          style={{ minHeight: 300 }}
        />

        {!scanning && (
          <div className="text-center text-white p-8 z-10">
            <span className="material-symbols-outlined text-5xl mb-3 text-primary block">qr_code_scanner</span>
            <p className="text-sm font-medium mb-5 text-slate-300">Tap to scan faculty re-entry pass</p>
            <button
              onClick={startScanner}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold text-sm flex items-center gap-2 mx-auto"
            >
              <span className="material-symbols-outlined text-lg">videocam</span>
              Open Camera
            </button>
          </div>
        )}

        {scanning && (
          <button
            onClick={stopScanner}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-red-500 text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-lg"
          >
            Stop Scanner
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
          <span>{error}</span>
        </div>
      )}

      {scanResult && (
        <div className="rounded-xl p-4 border-2 bg-green-50 border-green-200 dark:bg-green-900/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-2xl text-green-600">home</span>
            <div>
              <p className="font-bold text-sm">{scanResult.facultyName}</p>
              <p className="text-xs text-slate-500">{scanResult.facultyIdCode}</p>
            </div>
          </div>
          <p className="text-sm font-bold text-green-700">Re-entry Logged Successfully</p>
          <p className="text-xs text-slate-500 mt-1">{scanResult.scannedAt} | {scanResult.leaveType}</p>
        </div>
      )}

      <ScanLog refreshKey={refreshLog} />
    </div>
  )
}
