'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import Modal from '@/components/ui/Modal'

type Tab = 'hr' | 'promote'

export default function StaffManagement() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('hr')

  // HR staff list
  const [hrStaff, setHrStaff] = useState<Profile[]>([])
  const [hrLoading, setHrLoading] = useState(true)

  // Faculty list (for promote tab)
  const [faculty, setFaculty] = useState<Profile[]>([])
  const [facultyLoading, setFacultyLoading] = useState(true)
  const [facultySearch, setFacultySearch] = useState('')

  // Modals
  const [addModal, setAddModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null })
  const [roleModal, setRoleModal] = useState<{ open: boolean; profile: Profile | null; direction: 'promote' | 'demote' }>({ open: false, profile: null, direction: 'promote' })

  // Add form
  const [form, setForm] = useState({ fullName: '', email: '', password: '', designation: '', facultyId: '' })
  const [submitting, setSubmitting] = useState(false)

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchHR = useCallback(async () => {
    setHrLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('role', 'hr').order('full_name')
    setHrStaff(data || [])
    setHrLoading(false)
  }, [supabase])

  const fetchFaculty = useCallback(async () => {
    setFacultyLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('role', 'faculty').order('full_name')
    setFaculty(data || [])
    setFacultyLoading(false)
  }, [supabase])

  useEffect(() => { fetchHR(); fetchFaculty() }, [fetchHR, fetchFaculty])

  const filteredFaculty = faculty.filter(f =>
    f.full_name.toLowerCase().includes(facultySearch.toLowerCase()) ||
    (f.faculty_id || '').toLowerCase().includes(facultySearch.toLowerCase())
  )

  // -- Add new HR account --------------------------------------------------
  const handleAddStaff = async () => {
    if (!form.fullName || !form.email || !form.password) {
      showToast('error', 'Full name, email and password are required.')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/admin/create-faculty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        designation: form.designation,
        facultyId: form.facultyId || null,
        role: 'hr',
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.error) {
      showToast('error', data.error)
    } else {
      showToast('success', 'HR staff account created!')
      setAddModal(false)
      setForm({ fullName: '', email: '', password: '', designation: '', facultyId: '' })
      fetchHR()
    }
  }

  // -- Toggle active via admin API -----------------------------------------
  const handleToggleActive = async (p: Profile) => {
    const res = await fetch('/api/admin/manage-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: p.id, action: 'toggle_active' }),
    })
    const data = await res.json()
    if (!res.ok) showToast('error', data.error || 'Failed to update')
    else { showToast('success', `${p.full_name} marked ${data.is_active ? 'active' : 'inactive'}`); fetchHR(); fetchFaculty() }
  }

  // -- Change role (promote faculty->HR or demote HR->faculty) ---------------
  const handleRoleChange = async () => {
    if (!roleModal.profile) return
    const newRole = roleModal.direction === 'promote' ? 'hr' : 'faculty'
    const res = await fetch('/api/admin/manage-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: roleModal.profile.id, action: 'set_role', role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || 'Failed to change role')
    } else {
      showToast('success',
        roleModal.direction === 'promote'
          ? `${roleModal.profile.full_name} promoted to HR`
          : `${roleModal.profile.full_name} reverted to Faculty`
      )
      setRoleModal({ open: false, profile: null, direction: 'promote' })
      fetchHR()
      fetchFaculty()
    }
  }

  // -- Delete HR account ---------------------------------------------------
  const handleDelete = async () => {
    if (!deleteModal.profile) return
    const res = await fetch('/api/admin/manage-profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: deleteModal.profile.id }),
    })
    const data = await res.json()
    if (!res.ok) {
      showToast('error', data.error || 'Failed to delete')
    } else {
      showToast('success', `${deleteModal.profile.full_name}'s account deleted`)
      setDeleteModal({ open: false, profile: null })
      fetchHR()
    }
  }

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="p-4 space-y-4">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold">Staff Management</h3>
          <p className="text-xs text-slate-500 mt-0.5">Manage HR personnel accounts</p>
        </div>
        <button
          onClick={() => setAddModal(true)}
          className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Add HR Staff
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-start gap-2">
        <span className="material-symbols-outlined text-blue-500 text-sm mt-0.5">info</span>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          HR staff can approve and reject leave requests for all faculty. Their own leaves are handled by HOD only.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-indigo-50 rounded-xl p-3 text-center border border-slate-100">
          <p className="text-2xl font-bold text-indigo-600">{hrStaff.length}</p>
          <p className="text-[9px] text-slate-500 font-medium mt-0.5">Total HR Staff</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center border border-slate-100">
          <p className="text-2xl font-bold text-green-600">{hrStaff.filter(s => s.is_active).length}</p>
          <p className="text-[9px] text-slate-500 font-medium mt-0.5">Active</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        {([
          { id: 'hr', label: 'HR Accounts' },
          { id: 'promote', label: 'Promote Faculty' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-primary text-white'
                : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* -- HR Accounts Tab ----------------------------------------------- */}
      {tab === 'hr' && (
        <>
          {hrLoading && <p className="text-center text-slate-400 text-sm py-8">Loading...</p>}

          {!hrLoading && hrStaff.length === 0 && (
            <div className="text-center py-10 space-y-3">
              <span className="material-symbols-outlined text-5xl text-slate-300">badge</span>
              <p className="text-slate-400 text-sm font-medium">No HR staff accounts yet</p>
              <button onClick={() => setAddModal(true)} className="text-primary text-sm font-bold underline underline-offset-2">
                Create the first HR account
              </button>
            </div>
          )}

          {hrStaff.map(s => (
            <div
              key={s.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-sm transition-opacity ${
                s.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-100 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0 overflow-hidden">
                  {s.avatar_url
                    ? <img src={s.avatar_url} alt={s.full_name} className="h-10 w-10 rounded-full object-cover" />
                    : initials(s.full_name)
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{s.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{s.email}</p>
                  {s.designation && <p className="text-[10px] text-slate-400 mt-0.5">{s.designation}</p>}
                  {s.faculty_id && <p className="text-[10px] text-slate-400">ID: {s.faculty_id}</p>}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    HR
                  </span>
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(s)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      s.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600'
                        : 'bg-slate-100 text-slate-500 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>

              {/* Action buttons row */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {/* Demote back to faculty */}
                <button
                  onClick={() => setRoleModal({ open: true, profile: s, direction: 'demote' })}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-bold hover:bg-amber-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_downward</span>
                  Revert to Faculty
                </button>
                {/* Delete */}
                <button
                  onClick={() => setDeleteModal({ open: true, profile: s })}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Delete Account
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* -- Promote Faculty Tab -------------------------------------------- */}
      {tab === 'promote' && (
        <>
          <p className="text-xs text-slate-500">
            Promote an existing faculty member to HR. They will gain access to the HR dashboard and can approve/reject leave requests.
          </p>

          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={facultySearch}
              onChange={e => setFacultySearch(e.target.value)}
              placeholder="Search by name or faculty ID..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary"
            />
          </div>

          {facultyLoading && <p className="text-center text-slate-400 text-sm py-8">Loading...</p>}

          {!facultyLoading && filteredFaculty.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">
              {faculty.length === 0 ? 'No faculty members found' : 'No results match your search'}
            </p>
          )}

          {filteredFaculty.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {initials(f.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{f.full_name}</p>
                <p className="text-[10px] text-slate-500">
                  {f.faculty_id ? `ID: ${f.faculty_id}` : 'No ID'}{f.designation ? ` | ${f.designation}` : ''}
                </p>
              </div>
              <button
                onClick={() => setRoleModal({ open: true, profile: f, direction: 'promote' })}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">arrow_upward</span>
                Promote to HR
              </button>
            </div>
          ))}
        </>
      )}

      {/* -- Add HR Staff Modal --------------------------------------------- */}
      <Modal
        isOpen={addModal}
        onClose={() => { setAddModal(false); setForm({ fullName: '', email: '', password: '', designation: '', facultyId: '' }) }}
        title="Add HR Staff Account"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Create a new HR staff account. HR can approve/reject faculty leaves but cannot approve their own.
          </p>
          {[
            { label: 'Full Name *', key: 'fullName', type: 'text', placeholder: 'e.g. Dr. Priya Sharma' },
            { label: 'Email *', key: 'email', type: 'email', placeholder: 'hr@cmrtc.ac.in' },
            { label: 'Password *', key: 'password', type: 'password', placeholder: 'Minimum 8 characters' },
            { label: 'Faculty ID', key: 'facultyId', type: 'text', placeholder: 'e.g. FK-2024-10 (optional)' },
            { label: 'Designation', key: 'designation', type: 'text', placeholder: 'e.g. HR Manager' },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setAddModal(false); setForm({ fullName: '', email: '', password: '', designation: '', facultyId: '' }) }}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddStaff}
              disabled={submitting || !form.fullName || !form.email || !form.password}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {submitting
                ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Creating...</>
                : 'Create Account'
              }
            </button>
          </div>
        </div>
      </Modal>

      {/* -- Role Change Confirmation Modal --------------------------------- */}
      <Modal
        isOpen={roleModal.open}
        onClose={() => setRoleModal({ open: false, profile: null, direction: 'promote' })}
        title={roleModal.direction === 'promote' ? 'Promote to HR' : 'Revert to Faculty'}
      >
        {roleModal.profile && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              roleModal.direction === 'promote'
                ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200'
                : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200'
            }`}>
              <span className={`material-symbols-outlined text-xl ${roleModal.direction === 'promote' ? 'text-indigo-600' : 'text-amber-600'}`}>
                {roleModal.direction === 'promote' ? 'upgrade' : 'arrow_downward'}
              </span>
              <div>
                <p className="text-sm font-bold">{roleModal.profile.full_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {roleModal.direction === 'promote'
                    ? 'Will be promoted from Faculty -> HR. They will immediately gain access to the HR dashboard and can approve leave requests.'
                    : 'Will be reverted from HR -> Faculty. They will lose HR dashboard access and return to the faculty portal.'
                  }
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              This change takes effect immediately. The user's next login will redirect them to the correct dashboard.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRoleModal({ open: false, profile: null, direction: 'promote' })}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                className={`flex-1 py-2 rounded-lg text-white text-sm font-bold transition-colors ${
                  roleModal.direction === 'promote'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {roleModal.direction === 'promote' ? 'Yes, Promote' : 'Yes, Revert'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* -- Delete Confirmation Modal -------------------------------------- */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, profile: null })}
        title="Delete HR Account"
      >
        {deleteModal.profile && (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500 text-xl">warning</span>
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-300">This action is permanent</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Deleting <strong>{deleteModal.profile.full_name}</strong>'s account will remove all their data and revoke login access. This cannot be undone.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              If you want to temporarily restrict access, consider using the <strong>Inactive</strong> toggle instead.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal({ open: false, profile: null })}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
