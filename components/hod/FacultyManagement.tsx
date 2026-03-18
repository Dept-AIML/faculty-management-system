'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import Modal from '@/components/ui/Modal'

export default function FacultyManagement() {
  const supabase = createClient()
  const [faculty, setFaculty] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; profile: Profile | null }>({ open: false, profile: null })
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Add form
  const [form, setForm] = useState({ fullName: '', email: '', password: '', facultyId: '', designation: '' })
  // Edit form
  const [editForm, setEditForm] = useState({ fullName: '', facultyId: '', designation: '', isActive: true })

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchFaculty = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'faculty').order('full_name')
    setFaculty(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchFaculty() }, [fetchFaculty])

  const filteredFaculty = faculty.filter(f =>
    f.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.faculty_id || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleAddFaculty = async () => {
    const res = await fetch('/api/admin/create-faculty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password, fullName: form.fullName, facultyId: form.facultyId, designation: form.designation }),
    })
    const data = await res.json()
    if (data.error) showToast('error', data.error)
    else {
      showToast('success', 'Faculty added successfully!')
      setAddModal(false)
      setForm({ fullName: '', email: '', password: '', facultyId: '', designation: '' })
      fetchFaculty()
    }
  }

  const handleEdit = async () => {
    if (!editModal.profile) return
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.fullName,
      faculty_id: editForm.facultyId,
      designation: editForm.designation,
      is_active: editForm.isActive,
    }).eq('id', editModal.profile.id)

    if (error) showToast('error', error.message)
    else {
      showToast('success', 'Profile updated!')
      setEditModal({ open: false, profile: null })
      fetchFaculty()
    }
  }

  const openEdit = (p: Profile) => {
    setEditForm({ fullName: p.full_name, facultyId: p.faculty_id || '', designation: p.designation || '', isActive: p.is_active })
    setEditModal({ open: true, profile: p })
  }

  const toggleActive = async (p: Profile) => {
    const res = await fetch('/api/admin/manage-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: p.id, action: 'toggle_active' }),
    })
    const data = await res.json()
    if (!res.ok) showToast('error', data.error || 'Failed to update status')
    else { showToast('success', `${p.full_name} marked ${data.is_active ? 'active' : 'inactive'}`); fetchFaculty() }
  }

  const handleDelete = async () => {
    if (!deleteModal.profile) return
    const res = await fetch('/api/admin/manage-profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: deleteModal.profile.id }),
    })
    const data = await res.json()
    if (!res.ok) showToast('error', data.error || 'Failed to delete')
    else {
      showToast('success', `${deleteModal.profile.full_name}'s account deleted`)
      setDeleteModal({ open: false, profile: null })
      fetchFaculty()
    }
  }

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

      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Faculty Roster</h3>
        <button
          onClick={() => setAddModal(true)}
          className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          Add Faculty
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or ID..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary"
        />
      </div>

      {loading && <p className="text-center text-slate-400 text-sm py-8">Loading...</p>}

      {/* Faculty List */}
      <div className="space-y-3">
        {filteredFaculty.map(f => (
          <div key={f.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-sm">
                {f.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{f.full_name}</p>
                <p className="text-[10px] text-slate-500">{f.faculty_id} | {f.designation}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${f.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {f.is_active ? 'Active' : 'Inactive'}
              </span>
              <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-primary transition-colors" title="Edit">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              <button onClick={() => toggleActive(f)} className="text-slate-400 hover:text-primary transition-colors" title={f.is_active ? 'Deactivate' : 'Activate'}>
                <span className="material-symbols-outlined text-[18px]">{f.is_active ? 'toggle_on' : 'toggle_off'}</span>
              </button>
              <button onClick={() => setDeleteModal({ open: true, profile: f })} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </div>
        ))}
        {!loading && filteredFaculty.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No faculty found</p>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Faculty Member">
        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'fullName', type: 'text', placeholder: 'Dr. Name Surname' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'faculty@cseaiml.edu' },
            { label: 'Password', key: 'password', type: 'password', placeholder: 'Faculty@123' },
            { label: 'Faculty ID', key: 'facultyId', type: 'text', placeholder: 'FK-2024-06' },
            { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Assistant Professor' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={(form as any)[f.key]}
                onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button onClick={() => setAddModal(false)} className="flex-1 py-2 rounded-lg border text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleAddFaculty} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">Add</button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ open: false, profile: null })} title="Edit Faculty Profile">
        <div className="space-y-3">
          {[
            { label: 'Full Name', key: 'fullName', type: 'text' },
            { label: 'Faculty ID', key: 'facultyId', type: 'text' },
            { label: 'Designation', key: 'designation', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={(editForm as any)[f.key]}
                onChange={(e) => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary"
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded border-slate-300 text-primary focus:ring-primary" />
            Active
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setEditModal({ open: false, profile: null })} className="flex-1 py-2 rounded-lg border text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleEdit} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90">Save</button>
          </div>
        </div>
      </Modal>
      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, profile: null })} title="Delete Faculty Account">
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
              If you want to temporarily restrict access, use the <strong>toggle</strong> button to mark them inactive instead.
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