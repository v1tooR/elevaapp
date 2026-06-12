import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'
import type { Profile } from '@/types/database'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return (data as Profile | null)
}

export async function requireAuth(allowedRoles?: string[]): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (profile.role === 'cliente') redirect('/minha-area')
    else redirect('/dashboard')
  }

  return profile
}

export async function getClientByProfile(profileId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('profile_id', profileId)
    .single()
  return data as any
}
