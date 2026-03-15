'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type View = 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [view, setView] = useState<View>('form')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(5)

  // Verify there is an active recovery session when the page mounts.
  // Supabase fires an INITIAL_SESSION event after exchangeCodeForSession
  // sets the cookies — if there is no session at all, the link was invalid.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setView('invalid')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-redirect countdown after success
  useEffect(() => {
    if (view !== 'success') return
    if (secondsLeft <= 0) {
      router.push('/login')
      return
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [view, secondsLeft, router])

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
    } else {
      // Sign out so the user lands on a clean login screen
      await supabase.auth.signOut()
      setView('success')
    }
  }

  // ─── Strength indicator ────────────────────────────────────────────────────
  const getStrength = (p: string): { label: string; color: string; width: string } => {
    if (!p) return { label: '', color: 'bg-slate-200', width: 'w-0' }
    const hasUpper = /[A-Z]/.test(p)
    const hasLower = /[a-z]/.test(p)
    const hasNum   = /[0-9]/.test(p)
    const hasSpec  = /[^A-Za-z0-9]/.test(p)
    const score = [p.length >= 8, hasUpper, hasLower, hasNum, hasSpec].filter(Boolean).length
    if (score <= 2) return { label: 'Weak',   color: 'bg-red-400',    width: 'w-1/4' }
    if (score <= 3) return { label: 'Fair',   color: 'bg-amber-400',  width: 'w-2/4' }
    if (score <= 4) return { label: 'Good',   color: 'bg-blue-400',   width: 'w-3/4' }
    return             { label: 'Strong', color: 'bg-green-500',  width: 'w-full' }
  }
  const strength = getStrength(password)

  // ─── Invalid / expired link ────────────────────────────────────────────────
  if (view === 'invalid') {
    return (
      <Shell>
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-red-500 text-[32px]">link_off</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Link expired or invalid</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Password reset links expire after 1 hour. Please request a new one.
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to login
          </button>
        </div>
      </Shell>
    )
  }

  // ─── Success screen ────────────────────────────────────────────────────────
  if (view === 'success') {
    return (
      <Shell>
        <div className="space-y-5 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-green-500 text-[32px]">check_circle</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Password updated!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Your password has been changed successfully. You can now log in with your new password.
            </p>
          </div>
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${((5 - secondsLeft) / 5) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              Redirecting to login in {secondsLeft}s…
            </p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Go to login now
          </button>
        </div>
      </Shell>
    )
  }

  // ─── Reset form ────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Set new password</h3>
          <p className="text-xs text-slate-500 mt-1">Choose a strong password for your account.</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* New password */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 dark:text-slate-300 text-sm font-medium">New Password</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }}
                placeholder="Min. 8 characters"
                required
                className="w-full pl-10 pr-12 py-3 bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {/* Strength bar */}
            {password && (
              <div className="space-y-1">
                <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                </div>
                <p className="text-xs text-slate-400">{strength.label}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 dark:text-slate-300 text-sm font-medium">Confirm Password</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">lock_reset</span>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
                placeholder="Re-enter your password"
                required
                className="w-full pl-10 pr-12 py-3 bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showConfirm ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {/* Match indicator */}
            {confirmPassword && (
              <p className={`text-xs flex items-center gap-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {password === confirmPassword ? 'check_circle' : 'cancel'}
                </span>
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Updating…</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                <span>Update password</span>
              </>
            )}
          </button>
        </form>
      </div>
    </Shell>
  )
}

// ─── Shared shell (logo + card) ────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] flex flex-col items-center">

        {/* Logo */}
        <div className="mb-8 w-24 h-24 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center overflow-hidden border-2 border-primary/20">
          <img
            alt="CMR Technical Campus Logo"
            className="w-20 h-20 object-contain"
            src="/logo.png"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://lh3.googleusercontent.com/aida-public/AB6AXuDr0zKvBtQTG2Aw5FzG34qBvuzNqBl-vlyBYZpumGJD4oP2Yk0Dh0r6xa2zl_zvUReSYhcF-XYPbT1fljcNoJMSsH0z7MFCUqiOYb6Sk-S--83R_EQTObfkHLQf5UGdImDcqSfqQZiWnOibj_yNBa0DgPzdI8aRilXGYmCiTjfL99S2h7FwgRrEyhF6IUF2LCYNihHv6RDPgw9ZIlTfTqq1xruPn0Tq-_4SgUxwLaWSm5yvJQ9YHn4vSZWXVBaut0gP9XsnvVDBQuV'
            }}
          />
        </div>

        {/* Header */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold tracking-tight leading-tight">
            CMRTC Gate Pass Approval System
          </h1>
        </div>

        {/* Card */}
        <div className="w-full bg-white dark:bg-slate-900/50 rounded-xl shadow-xl p-6 border border-slate-200 dark:border-slate-800">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-slate-400 text-xs">
            © 2026 CMR Technical Campus<br />
            Department of CSE (Artificial Intelligence &amp; Machine Learning)
          </p>
        </footer>
      </div>
    </div>
  )
}
