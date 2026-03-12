'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, LeaveRequest } from '@/types'
import LeaveRequestForm from '@/components/faculty/LeaveRequestForm'
import ApprovedLeaveCard from '@/components/faculty/ApprovedLeaveCard'
import LeaveHistory from '@/components/faculty/LeaveHistory'
import BottomNav from '@/components/ui/BottomNav'
import AvatarUpload from '@/components/ui/AvatarUpload'

const TABS = [
  { id: 'home', label: 'Home', icon: 'grid_view' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'new', label: 'New', icon: 'add' },
  { id: 'profile', label: 'Profile', icon: 'person' },
]

export default function FacultyDashboardClient({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('home')
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState({ full_name: profile.full_name, designation: profile.designation || '', department: profile.department || '' })
  const [saving, setSaving] = useState(false)

  const fetchLeaves = useCallback(async () => {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('faculty_id', profile.id)
      .order('created_at', { ascending: false })
    setLeaveRequests(data || [])
    setLoading(false)
  }, [profile.id, supabase])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const approvedLeaves = leaveRequests.filter(r => r.status === 'approved')
  const approvedThisMonth = approvedLeaves.filter(r => {
    const d = new Date(r.start_datetime)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const leavesLeft = Math.max(0, 12 - approvedThisMonth.length)

  const initials = profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display relative flex min-h-screen flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            alt="University Logo"
            className="h-10 w-10 rounded-lg object-contain"
            src="/logo.png"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnrwTjigiZAhlLeFnycMqIRckn9EG8ncVdQXUxES6DpayAlRnz8gFn5uSlxW3fh5GZE7IKVCEFxKL_LuglGPK1yM2nUSXo-afvFDurQBD1dcAIPSr83nspIBT5g0jAZzUDHAzph4JWfoBTzvJ8JxMm6T7e0BJSLbXO-M5mrdHS4tXqVl2udhgupIX5jF_NVLctr71zlH-uLlsrhFkaMlaNiggnvLQDC-Zsz7IQugL2yjYAkg6uzzSfEXm_61YAmkdwbR1qDKWjSVjX' }}
          />
          <div>
            <h1 className="text-lg font-bold leading-tight">Faculty Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Computer Science Department</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            title="Logout"
          >
            {initials}
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {/* Profile Card — always visible */}
        <section className="p-4">
          <div className="flex items-center gap-4 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="h-16 w-16 rounded-full ring-2 ring-primary/20 flex-shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover rounded-full" />
              ) : (
                <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.full_name}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {profile.designation} | {profile.faculty_id}
              </p>
              <div className="mt-1 flex gap-2">
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                  Active
                </span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {leavesLeft} Leaves Left
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab content */}
        {(activeTab === 'home' || activeTab === 'new') && (
          <LeaveRequestForm facultyId={profile.id} onSuccess={fetchLeaves} />
        )}

        {(activeTab === 'home') && (
          <>
            {/* Approved Leaves Carousel */}
            <section className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Approved Leaves</h3>
                <span className="text-xs font-semibold text-primary">{approvedLeaves.length} total</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {loading && (
                  <div className="min-w-[280px] rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center h-32">
                    <span className="text-slate-400 text-sm">Loading...</span>
                  </div>
                )}
                {!loading && approvedLeaves.length === 0 && (
                  <div className="min-w-[280px] rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center h-32">
                    <span className="text-slate-400 text-sm">No approved leaves yet</span>
                  </div>
                )}
                {approvedLeaves.map(leave => (
                  <ApprovedLeaveCard
                    key={leave.id}
                    leave={leave}
                    facultyName={profile.full_name}
                    facultyIdCode={profile.faculty_id || ''}
                  />
                ))}
              </div>
            </section>

            <LeaveHistory requests={leaveRequests} />
          </>
        )}

        {activeTab === 'history' && (
          <LeaveHistory requests={leaveRequests} />
        )}

        {activeTab === 'profile' && (
          <section className="p-4 space-y-4">
            <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Profile Details</h3>
                <button onClick={() => setEditMode(e => !e)} className="text-primary text-sm font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">{editMode ? 'close' : 'edit'}</span>
                  {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {/* Avatar Upload */}
              <div className="flex justify-center py-2">
                <AvatarUpload
                  userId={profile.id}
                  currentUrl={profile.avatar_url}
                  initials={initials}
                  size="lg"
                />
              </div>
              {editMode ? (
                <div className="space-y-3">
                  {[
                    { label: 'Full Name', key: 'full_name' },
                    { label: 'Designation', key: 'designation' },
                    { label: 'Department', key: 'department' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                      <input
                        value={editValues[key as keyof typeof editValues]}
                        onChange={e => setEditValues(v => ({ ...v, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                  <div className="flex justify-between text-sm py-2 border-t border-slate-100">
                    <span className="text-slate-500">Email</span>
                    <span className="font-semibold text-slate-400">{profile.email}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setSaving(true)
                      const { error } = await supabase.from('profiles').update(editValues).eq('id', profile.id)
                      setSaving(false)
                      if (!error) { setEditMode(false); window.location.reload() }
                    }}
                    disabled={saving}
                    className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              ) : (
                [
                  { label: 'Full Name', value: profile.full_name },
                  { label: 'Faculty ID', value: profile.faculty_id || 'N/A' },
                  { label: 'Email', value: profile.email },
                  { label: 'Designation', value: profile.designation || 'N/A' },
                  { label: 'Department', value: profile.department || 'CSE (AI & ML)' },
                  { label: 'Status', value: profile.is_active ? 'Active' : 'Inactive' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm border-b border-slate-50 dark:border-slate-800 pb-2">
                    <span className="text-slate-500 font-medium">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors">
              <span className="material-symbols-outlined">logout</span> Logout
            </button>
          </section>
        )}
      </main>

      <BottomNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} variant="faculty" />
    </div>
  )
}
