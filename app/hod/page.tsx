import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Legacy route -- middleware handles /hod -> /dashboard, this is a fallback
export default async function HODLegacyPage() {
  redirect('/dashboard')
}
