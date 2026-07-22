import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/auth/callback']
  const isPublicRoute = pathname === '/'
    || publicRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
    || pathname.startsWith('/api/')

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, must_change_password, mfa_required')
      .eq('auth_user_id', user.id)
      .single()

    const isApiRoute = pathname.startsWith('/api/')
    const accessGateExempt = pathname === '/reset-password'
      || pathname.startsWith('/mfa/')
      || pathname === '/auth/callback'
      || pathname === '/api/auth/logout'

    if (profile && !profile.is_active && !accessGateExempt) {
      if (isApiRoute) return NextResponse.json({ error: 'Acesso inativo.' }, { status: 403 })
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'acesso_inativo')
      return NextResponse.redirect(url)
    }

    if (profile?.is_active && profile.role !== 'cliente' && !accessGateExempt) {
      if (profile.must_change_password) {
        if (isApiRoute) return NextResponse.json({ error: 'Conclua a definição da sua senha.' }, { status: 403 })
        const url = request.nextUrl.clone()
        url.pathname = '/reset-password'
        url.searchParams.set('first_access', '1')
        return NextResponse.redirect(url)
      }

      if (profile.mfa_required) {
        const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assurance?.currentLevel !== 'aal2') {
          if (isApiRoute) return NextResponse.json({ error: 'Confirme a autenticação em duas etapas.' }, { status: 403 })
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const url = request.nextUrl.clone()
          url.pathname = factors?.totp.some(factor => factor.status === 'verified') ? '/mfa/verify' : '/mfa/setup'
          url.search = ''
          return NextResponse.redirect(url)
        }
      }
    }

    if (pathname === '/login' && profile?.is_active) {
      const url = request.nextUrl.clone()
      url.pathname = profile.role === 'cliente' ? '/minha-area' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
