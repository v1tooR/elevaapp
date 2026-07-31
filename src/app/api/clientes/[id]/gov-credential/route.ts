import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  encryptGovCredential,
  GovCredentialConfigurationError,
} from '@/lib/gov-credential-crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const credentialSchema = z.object({
  password: z.string().min(1).max(256),
}).strict()

const clientIdSchema = z.string().uuid()

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS })
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expectedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !expectedHost) return true

  try {
    return new URL(origin).host === expectedHost
  } catch {
    return false
  }
}

async function getAuthorizedStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, authorized: false as const, status: 401 }

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const authorized = Boolean(
    caller && ['super_admin', 'admin', 'analista'].includes(caller.role),
  )

  return { supabase, authorized, status: authorized ? 200 : 403 }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return json({ error: 'Origem da solicitação não permitida.' }, 403)
  }

  const parsedClientId = clientIdSchema.safeParse((await params).id)
  if (!parsedClientId.success) {
    return json({ error: 'Cliente inválido.' }, 422)
  }

  const { supabase, authorized, status } = await getAuthorizedStaff()
  if (!authorized) {
    return json(
      { error: status === 401 ? 'Não autorizado.' : 'Sem permissão para armazenar a credencial.' },
      status,
    )
  }

  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'Conteúdo da solicitação inválido.' }, 415)
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return json({ error: 'Conteúdo da solicitação excede o limite permitido.' }, 413)
  }

  const parsed = credentialSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return json({ error: 'Informe uma senha válida com até 256 caracteres.' }, 422)
  }

  let envelope
  try {
    envelope = encryptGovCredential(parsed.data.password, parsedClientId.data)
  } catch (error) {
    if (error instanceof GovCredentialConfigurationError) {
      return json({ error: error.message }, 503)
    }
    return json({ error: 'Não foi possível proteger a credencial.' }, 500)
  }

  const { error } = await supabase.rpc('store_gov_credential_envelope', {
    p_algorithm: envelope.algorithm,
    p_authentication_tag: envelope.authenticationTag,
    p_ciphertext: envelope.ciphertext,
    p_client_id: parsedClientId.data,
    p_initialization_vector: envelope.initializationVector,
    p_key_version: envelope.keyVersion,
  })

  if (error) {
    return json({ error: 'Não foi possível armazenar a credencial protegida.' }, 400)
  }

  revalidatePath(`/clientes/${parsedClientId.data}`)
  return json({ success: true }, 201)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) {
    return json({ error: 'Origem da solicitação não permitida.' }, 403)
  }

  const parsedClientId = clientIdSchema.safeParse((await params).id)
  if (!parsedClientId.success) {
    return json({ error: 'Cliente inválido.' }, 422)
  }

  const { supabase, authorized, status } = await getAuthorizedStaff()
  if (!authorized) {
    return json(
      { error: status === 401 ? 'Não autorizado.' : 'Sem permissão para excluir a credencial.' },
      status,
    )
  }

  const { error } = await supabase.rpc('delete_gov_credential', {
    p_client_id: parsedClientId.data,
  })

  if (error) {
    return json({ error: 'Não foi possível excluir a credencial protegida.' }, 400)
  }

  revalidatePath(`/clientes/${parsedClientId.data}`)
  return json({ success: true })
}
