import 'server-only'

import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'
import type { Client, Profile } from '@/types/database'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single()

  return (data as Profile | null)
}

export async function requireAuth(allowedRoles?: string[]): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  if (profile.role !== 'cliente') {
    if (profile.must_change_password) redirect('/reset-password?first_access=1')

    if (profile.mfa_required) {
      const supabase = await createClient()
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance?.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const hasVerifiedFactor = factors?.totp.some(factor => factor.status === 'verified') ?? false
        redirect(hasVerifiedFactor ? '/mfa/verify' : '/mfa/setup')
      }
    }
  }

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
  return data as Client | null
}
