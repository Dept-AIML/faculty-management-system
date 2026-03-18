// TypeScript interfaces for the Faculty Leave Approval System

export interface Profile {
  id: string
  full_name: string
  faculty_id: string | null
  email: string
  role: 'faculty' | 'hod' | 'hr'
  designation: string | null
  department: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeaveRequest {
  id: string
  faculty_id: string
  leave_type: 'personal' | 'medical' | 'emergency' | 'official' | 'other'
  reason: string
  start_datetime: string
  end_datetime: string
  status: 'pending' | 'approved' | 'rejected'
  hod_remarks: string | null
  approved_by: string | null
  approved_at: string | null
  qr_token: string | null
  qr_generated_at: string | null
  created_at: string
  updated_at: string
  // Joined fields
  profiles?: Profile
}

export interface QRScanLog {
  id: string
  leave_request_id: string
  faculty_id: string
  scan_type: 'exit' | 'reentry'
  scanned_at: string
  scanned_by_hod: string | null
  notes: string | null
  // Joined
  profiles?: Profile
  leave_requests?: LeaveRequest
}

export interface QRPayload {
  leaveId: string       // leave_requests.id
  facultyId: string     // profiles.id
  facultyName: string
  facultyIdCode: string // e.g. FK-2024-01
  approvedAt: string
  leaveType: string
  qrToken: string
}

export interface ReportRow {
  facultyId: string
  fullName: string
  email: string
  leaveCount: number
  exceededCount: number
}

export type LeaveType = 'personal' | 'medical' | 'emergency' | 'official' | 'other'
export type LeaveStatus = 'pending' | 'approved' | 'rejected'
export type ScanType = 'exit' | 'reentry'
