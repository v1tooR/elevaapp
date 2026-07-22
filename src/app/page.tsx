import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, must_change_password, mfa_required')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login?error=acesso_inativo')
  if (profile?.role === 'cliente') redirect('/minha-area')
  if (profile.must_change_password) redirect('/reset-password?first_access=1')
  if (profile.mfa_required) {
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assurance?.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      redirect(factors?.totp.some(factor => factor.status === 'verified') ? '/mfa/verify' : '/mfa/setup')
    }
  }
  redirect('/dashboard')
}
