'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, LeaveRequest } from '@/types'
import PendingRequests from '@/components/hod/PendingRequests'
import QRScanner from '@/components/hod/QRScanner'
import LeaveRequestForm from '@/components/faculty/LeaveRequestForm'
import LeaveHistory from '@/components/faculty/LeaveHistory'
import ApprovedLeaveCard from '@/components/faculty/ApprovedLeaveCard'
import AvatarUpload from '@/components/ui/AvatarUpload'

// HR tabs: Dashboard, My Leave, Scan, Settings
const TABS = [
  { id: 'requests', label: 'Dashboard', icon: 'dashboard' },
  { id: 'myleave',  label: 'My Leave',  icon: 'event_note' },
  { id: 'scanner',  label: 'Scan',      icon: 'qr_code_2' },
  { id: 'settings', label: 'Settings',  icon: 'settings' },
]

const HEADER_TABS = [
  { id: 'requests', label: 'Pending Requests' },
  { id: 'myleave',  label: 'My Leave' },
  { id: 'scanner',  label: 'QR Scanner' },
]

export default function HRDashboardClient({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('requests')
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState({
    full_name:   profile.full_name,
    designation: profile.designation || '',
    department:  profile.department  || '',
  })
  const [saving, setSaving] = useState(false)

  // Own leave requests (for My Leave tab)
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([])
  const [myLeavesLoading, setMyLeavesLoading] = useState(true)

  const fetchMyLeaves = useCallback(async () => {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('faculty_id', profile.id)
      .order('created_at', { ascending: false })
    setMyLeaves(data || [])
    setMyLeavesLoading(false)
  }, [profile.id, supabase])

  useEffect(() => { fetchMyLeaves() }, [fetchMyLeaves])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const approvedLeaves = myLeaves.filter(r => r.status === 'approved')
  const approvedThisMonth = approvedLeaves.filter(r => {
    const d = new Date(r.start_datetime)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const leavesLeft = Math.max(0, 12 - approvedThisMonth.length)

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased min-h-screen">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
            <img
              alt="Department Logo"
              className="h-8 w-8 object-contain"
              src="/logo.png"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBF9oNbWmQFhpPftttMOEeJamAyZYv1CfY0Q2aSqj9mh9rIvstJ6mv6imob7eWY6Dy48fvAXq2m8xcNTy-7i14QSmqdrOw5O0q7KzodMhZWIRjUvUZWfklIBHVHgTmHWeKWkBWK5055hOuZnci7IM2PBU-l_4hed9B-zWOnRBcrs-k2ITYB-X5hw1kY-Xa5PPaYeypfVc4rnBJjBUEqGVvw41p976vkD98J8o_sqiRmhhi9fx0z28pzzMKAtKU4aClFUkOlidQO1ujc' }}
            />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none text-primary">CSE AI&amp;ML</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Faculty Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary" />
          </button>
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            title="Logout"
          >
            {initials}
          </button>
        </div>
      </header>

      {/* HR Profile Summary */}
      <section className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border-2 border-primary/20 flex-shrink-0 overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-cover rounded-full" />
            ) : (
              <div className="h-full w-full rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xl font-bold">
                {initials}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold">{profile.full_name}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {profile.designation || 'HR Staff'}, CSE AI&amp;ML
            </p>
            <div className="mt-1 flex gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase">
                HR
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Can approve faculty leaves
              </span>
              {activeTab === 'myleave' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                  {leavesLeft} Leaves Left
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Scrollable Tab Bar */}
      <div className="sticky top-[65px] z-40 bg-white dark:bg-slate-900 overflow-x-auto border-b border-slate-200 dark:border-slate-800 no-scrollbar">
        <div className="flex px-4">
          {HEADER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-24">

        {/* -- Pending Requests (approve faculty leaves) -- */}
        {activeTab === 'requests' && (
          <PendingRequests hodId={profile.id} approverRole="hr" />
        )}

        {/* -- My Leave (HR's own leave requests, handled by HOD) -- */}
        {activeTab === 'myleave' && (
          <div className="space-y-2">
            {/* Info banner */}
            <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0">info</span>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Your leave requests are reviewed and approved by the <strong>HOD only</strong>. Submit below and you will be notified by email once actioned.
              </p>
            </div>

            {/* Leave request form */}
            <LeaveRequestForm facultyId={profile.id} onSuccess={fetchMyLeaves} />

            {/* Approved leaves carousel */}
            <section className="px-4 py-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Approved Leaves</h3>
                <span className="text-xs font-semibold text-primary">{approvedLeaves.length} total</span>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {myLeavesLoading && (
                  <div className="min-w-[280px] rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center h-32">
                    <span className="text-slate-400 text-sm">Loading...</span>
                  </div>
                )}
                {!myLeavesLoading && approvedLeaves.length === 0 && (
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

            {/* Full history */}
            <LeaveHistory requests={myLeaves} />
          </div>
        )}

        {/* -- QR Scanner -- */}
        {activeTab === 'scanner' && (
          <QRScanner hodId={profile.id} scannerRole="hr" />
        )}

        {/* -- Settings -- */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            <div className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Settings</h3>
                <button
                  onClick={() => setEditMode(e => !e)}
                  className="text-primary text-sm font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">{editMode ? 'close' : 'edit'}</span>
                  {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>

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
                    { label: 'Full Name',    key: 'full_name' },
                    { label: 'Designation',  key: 'designation' },
                    { label: 'Department',   key: 'department' },
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
                  <div className="flex justify-between text-sm py-2">
                    <span className="text-slate-500">Role</span>
                    <span className="font-semibold">HR Staff</span>
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
                  { label: 'Full Name',   value: profile.full_name },
                  { label: 'Email',       value: profile.email },
                  { label: 'Role',        value: 'HR Staff' },
                  { label: 'Department',  value: profile.department || 'CSE (AI & ML)' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between text-sm border-b border-slate-50 dark:border-slate-800 pb-2">
                    <span className="text-slate-500 font-medium">{item.label}</span>
                    <span className="text-slate-900 dark:text-slate-100 font-semibold">{item.value}</span>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation -- 4 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1 shadow-2xl">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto">
          {TABS.map((tab, index) => {
            const isCenter = index === 2   // Scan is center (index 2 of 4)
            const isActive = activeTab === tab.id
            if (isCenter) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center gap-1 -mt-8"
                >
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg shadow-primary/40 border-4 border-white dark:border-slate-900 bg-primary text-white transition-transform ${isActive ? 'scale-110' : ''}`}>
                    <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
                  </div>
                  <span className={`text-[10px] font-medium mt-1 ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                    {tab.label}
                  </span>
                </button>
              )
            }
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
