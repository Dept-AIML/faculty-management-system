'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AvatarUploadProps {
  userId: string
  currentUrl: string | null
  initials: string
  size?: 'md' | 'lg'
  onUpload?: (url: string) => void
}

export default function AvatarUpload({ userId, currentUrl, initials, size = 'lg', onUpload }: AvatarUploadProps) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sizeClass = size === 'lg'
    ? 'h-20 w-20 text-2xl'
    : 'h-16 w-16 text-xl'

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.')
      return
    }

    setError(null)
    setUploading(true)

    // Create a local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    // Upload to Supabase Storage — use userId as filename so it auto-overwrites
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) {
      setError('Upload failed: ' + uploadErr.message)
      setPreview(currentUrl)
      setUploading(false)
      return
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    // Save to profiles table
    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    setUploading(false)

    if (dbErr) {
      setError('Could not save avatar URL: ' + dbErr.message)
      return
    }

    setPreview(publicUrl)
    onUpload?.(publicUrl)
  }, [supabase, userId, currentUrl, onUpload])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar circle — click to upload */}
      <div
        className={`relative ${sizeClass} rounded-full ring-2 ring-primary/20 cursor-pointer group flex-shrink-0`}
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        title="Click to change photo"
      >
        {preview ? (
          <img
            src={preview}
            alt="Profile"
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div className={`h-full w-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold`}>
            {initials}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span className="material-symbols-outlined text-white text-lg">photo_camera</span>
          )}
        </div>

        {/* Upload badge */}
        <div className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center border-2 border-white dark:border-slate-900">
          <span className="material-symbols-outlined text-white text-[12px]">edit</span>
        </div>
      </div>

      <p className="text-[10px] text-slate-400">Tap photo to upload</p>

      {error && (
        <p className="text-[11px] text-red-500 text-center">{error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
