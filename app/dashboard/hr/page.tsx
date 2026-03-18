import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HRDashboardClient from '@/components/hr/HRDashboardClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'HR Dashboard | CMR Leave System',
}

export default async function HRDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.email!.split('@')[0],
        role: user.user_metadata?.role || 'faculty',
      })
      .select('*')
      .single()
    profile = newProfile
  }

  if (!profile) redirect('/login')
  if (profile.role !== 'hr') redirect('/dashboard')

  return <HRDashboardClient profile={profile} />
}
