import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HODDashboardClient from '@/components/hod/HODDashboardClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'HOD Dashboard | CMR Leave System',
}

export default async function HODDashboardPage() {
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
  if (profile.role !== 'hod') redirect('/dashboard')

  return <HODDashboardClient profile={profile} />
}
