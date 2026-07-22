'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { ElevaIcon } from '@/components/brand/eleva-icon'
import { ElevaLogo } from '@/components/brand/eleva-logo'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

const PROCESS_STEPS = [
  { label: 'Documentos recebidos', detail: 'Concluído', complete: true },
  { label: 'Análise do processo', detail: 'Em andamento', complete: false },
  { label: 'Protocolo no órgão', detail: 'Próxima etapa', complete: false },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'link_invalido') {
        return 'Link inválido ou expirado. Solicite um novo link de redefinição.'
      }
    }
    return ''
  })

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      const emailPending = authError.message.toLocaleLowerCase().includes('email not confirmed')
      setError(
        emailPending
          ? 'Este e-mail ainda não foi confirmado. Peça ao SuperAdmin para revisar o seu acesso.'
          : 'E-mail ou senha incorretos. Verifique suas credenciais.'
      )
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('auth_user_id', data.user.id)
      .single()

    router.push(profile?.role === 'cliente' ? '/minha-area' : '/dashboard')
    router.refresh()
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambientTop} aria-hidden="true" />
      <div className={styles.ambientBottom} aria-hidden="true" />

      <section className={`${styles.shell} ${styles.enter}`}>
        <aside className={styles.brandPanel}>
          <div className={styles.brandPattern} aria-hidden="true" />
          <div className={styles.brandGlow} aria-hidden="true" />

          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/8 p-2.5 shadow-sm">
                <ElevaIcon className="h-full w-full" fill="#EFE3D6" />
              </div>
              <div>
                <p className="font-display text-[15px] font-bold tracking-[0.19em] text-white">ELEVA</p>
                <p className="text-[11px] tracking-[0.08em] text-white/45">Isenções</p>
              </div>
            </div>

            <div className="my-auto py-12">
              <span className="inline-flex items-center rounded-full border border-[#C97A52]/25 bg-[#C97A52]/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-[#E2A27F]">
                Assessoria especializada para PCD
              </span>

              <h1 className="mt-6 max-w-lg font-display text-[42px] font-bold leading-[1.08] tracking-[-0.035em] text-white xl:text-[50px]">
                Transformamos seu direito em{' '}
                <span className="text-[#D98A61]">conquista.</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-7 text-[#EFE3D6]/62">
                Acompanhe documentos, etapas e prazos do seu processo com clareza, segurança e tranquilidade.
              </p>

              <div className="mt-9 max-w-md rounded-[22px] border border-white/9 bg-white/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-white/8 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/35">Seu processo</p>
                    <p className="mt-1 font-display text-sm font-bold text-white">Acompanhamento em tempo real</p>
                  </div>
                  <span className="rounded-full border border-[#C97A52]/20 bg-[#C97A52]/12 px-2.5 py-1 text-[10px] font-bold text-[#E2A27F]">
                    42% concluído
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {PROCESS_STEPS.map((step, index) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          step.complete
                            ? 'border-[#7D906E]/30 bg-[#7D906E]/15 text-[#A7BA99]'
                            : index === 1
                              ? 'border-[#C97A52]/30 bg-[#C97A52]/15 text-[#E2A27F]'
                              : 'border-white/10 bg-white/5 text-white/30'
                        }`}
                      >
                        {step.complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white/80">{step.label}</p>
                        <p className="mt-0.5 text-[10px] text-white/32">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/7">
                  <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-[#A14F2A] to-[#C97A52]" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/30">
              <span>© {new Date().getFullYear()} Eleva Isenções</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ambiente seguro
              </span>
            </div>
          </div>
        </aside>

        <div className={`${styles.formPanel} flex min-w-0 items-center bg-card lg:px-14 xl:px-20`}>
          <div className={`${styles.formContent} mx-auto w-full max-w-[410px]`}>
            <div className={`${styles.mobileLogo} lg:hidden`}>
              <ElevaLogo className="h-auto w-[138px] sm:w-[156px]" fill="#6B3019" />
            </div>

            <div className={styles.formHeader}>
              <div className="mb-5 hidden items-center gap-2 text-xs font-semibold text-muted-foreground lg:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <LockKeyhole className="h-3.5 w-3.5" />
                </span>
                Acesso seguro à plataforma
              </div>
              <h2 className="font-display text-[29px] font-bold leading-tight tracking-[-0.025em] text-foreground sm:text-[36px]">
                Bem-vindo de volta
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Entre com seus dados para acessar sua conta Eleva.
              </p>
            </div>

            <form onSubmit={handleLogin} className={styles.loginForm}>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-foreground">
                  E-mail
                </label>
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/65 transition-colors group-focus-within:text-primary" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="next"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={loading}
                    className={`${styles.input} w-full rounded-xl border border-input bg-[#FBF9F7] py-3 pl-12 pr-4 text-foreground outline-none transition-all placeholder:text-muted-foreground/55 hover:border-[#D8C7BA] focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-65`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="password" className="block text-sm font-semibold text-foreground">
                    Senha
                  </label>
                  <Link href="/forgot-password" className="whitespace-nowrap py-1 text-xs font-semibold text-primary transition-colors hover:text-[#6B3019]">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="group relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/65 transition-colors group-focus-within:text-primary" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder="Digite sua senha"
                    required
                    autoComplete="current-password"
                    enterKeyHint="go"
                    disabled={loading}
                    className={`${styles.input} w-full rounded-xl border border-input bg-[#FBF9F7] py-3 pl-12 pr-12 text-foreground outline-none transition-all placeholder:text-muted-foreground/55 hover:border-[#D8C7BA] focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-65`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  <p className="text-sm leading-5 text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className={`${styles.submitButton} group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-[15px] font-bold text-primary-foreground shadow-[0_8px_24px_rgba(161,79,42,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#8C4222] hover:shadow-[0_10px_28px_rgba(161,79,42,0.28)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar na plataforma
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className={`${styles.separator} flex items-center gap-3`}>
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-[0.11em] text-muted-foreground/65">Eleva Isenções</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <p className={`${styles.helperText} text-center text-xs leading-5 text-muted-foreground`}>
              Área exclusiva para clientes e equipe Eleva.<br />
              Em caso de dúvidas, fale com seu assessor.
            </p>

            <p className={`${styles.mobileCopyright} text-center text-[11px] text-muted-foreground/60 lg:hidden`}>
              © {new Date().getFullYear()} Eleva Isenções. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
