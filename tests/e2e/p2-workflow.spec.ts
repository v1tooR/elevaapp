import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

loadEnvConfig(process.cwd())

const SERVICES = ['cnh_especial', 'ipi', 'icms', 'ipva'] as const
const TYPE_SLUGS = ['cnh_especial', 'processo_ipi', 'processo_icms', 'processo_ipva'] as const
const allowRemote = process.env.P2_INTEGRATION_ALLOW_REMOTE === '1'
  || process.env.npm_lifecycle_event === 'test:e2e:p2'

type ProcessRow = {
  id: string
  process_type_id: string
  status: string
  blocked_reason: string | null
  vehicle_id: string | null
}

type ApiResult = {
  status: number
  body: Record<string, unknown>
}

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Variável obrigatória ausente para o teste P2: ${name}`)
  return value
}

function dateInYears(years: number) {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString().slice(0, 10)
}

async function browserJson(
  page: Page,
  path: string,
  method: 'POST' | 'PATCH',
  body: Record<string, unknown>,
): Promise<ApiResult> {
  return page.evaluate(async input => {
    const response = await fetch(input.path, {
      method: input.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.body),
    })
    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
    }
  }, { path, method, body })
}

async function assertNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content, `overflow horizontal em ${page.url()}`).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test.describe('P2 — conversão, progressão e experiência operacional', () => {
  test.skip(!allowRemote, 'Execute por npm run test:e2e:p2 ou defina P2_INTEGRATION_ALLOW_REMOTE=1.')

  let admin: SupabaseClient
  let authUserId = ''
  let profileId = ''
  let leadId = ''
  let clientId = ''
  let hasMigration033 = false
  let processTypes = new Map<string, string>()
  const marker = randomUUID().slice(0, 8)
  const testName = `[E2E P2 ${marker}] Fluxo completo`
  const testEmail = `e2e-p2-${marker}@example.invalid`
  const testPassword = `P2!${randomUUID()}Aa7`
  const today = new Date().toISOString().slice(0, 10)
  const cnhExpiry = dateInYears(5)
  const nextVehicleChange = dateInYears(4)
  const longNotes = `Registro temporário de integração P2 ${marker}. `
    + 'Observação extensa para validar leitura, quebra de linha e responsividade. '.repeat(70)

  async function getProcesses() {
    const { data, error } = await admin
      .from('processes')
      .select('id, process_type_id, status, blocked_reason, vehicle_id')
      .eq('client_id', clientId)
      .in('process_type_id', [...processTypes.values()])
    if (error) throw error

    const slugByType = new Map([...processTypes].map(([slug, id]) => [id, slug]))
    return new Map((data as ProcessRow[]).map(row => [slugByType.get(row.process_type_id)!, row]))
  }

  async function getStage(processId: string, stageKey: string) {
    const { data, error } = await admin
      .from('process_stages')
      .select('id, status, result, data')
      .eq('process_id', processId)
      .eq('stage_key', stageKey)
      .single()
    if (error) throw error
    return data
  }

  test.beforeAll(async () => {
    admin = createClient(
      requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
      requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { name: testName, role: 'admin' },
    })
    if (authError || !authData.user) throw authError ?? new Error('Usuário E2E não criado.')
    authUserId = authData.user.id

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({ role: 'admin', is_active: true, must_change_password: false, mfa_required: false })
      .eq('auth_user_id', authUserId)
      .select('id')
      .single()
    if (profileError || !profile) throw profileError ?? new Error('Perfil E2E não criado.')
    profileId = profile.id

    const { data: types, error: typesError } = await admin
      .from('process_types')
      .select('id, slug')
      .in('slug', [...TYPE_SLUGS])
      .eq('is_active', true)
      .eq('accepts_new_processes', true)
    if (typesError) throw typesError
    processTypes = new Map((types ?? []).map(type => [type.slug as string, type.id as string]))
    expect(processTypes.size).toBe(TYPE_SLUGS.length)

    const { data: lead, error: leadError } = await admin
      .from('leads')
      .insert({
        name: testName,
        phone: '(11) 99999-0000',
        email: testEmail,
        is_driver: true,
        has_cnh_especial: false,
        cnh_status: 'comum',
        medical_assessment_status: 'nao_realizada',
        disability_type: 'fisica',
        disability_types: ['fisica', 'auditiva'],
        cnh_restrictions: ['B'],
        receives_loas_bpc: true,
        has_medical_report: true,
        has_legal_representative: false,
        intended_service: 'cnh_especial',
        intended_services: [...SERVICES],
        lead_source: 'outros',
        assigned_to: profileId,
        status: 'novo',
        notes: longNotes,
      })
      .select('id')
      .single()
    if (leadError || !lead) throw leadError ?? new Error('Lead E2E não criado.')
    leadId = lead.id
  })

  test.afterAll(async () => {
    if (!admin) return
    const cleanupErrors: string[] = []
    if (clientId) {
      const engagementResult = await admin
        .from('client_service_engagements')
        .select('id')
        .eq('client_id', clientId)
      if (engagementResult.error) cleanupErrors.push(engagementResult.error.message)
      const engagementIds = (engagementResult.data ?? []).map(item => item.id)
      if (engagementIds.length > 0) {
        const itemDelete = await admin
          .from('client_service_plan_items')
          .delete()
          .in('engagement_id', engagementIds)
        if (itemDelete.error) cleanupErrors.push(itemDelete.error.message)
        const engagementDelete = await admin
          .from('client_service_engagements')
          .delete()
          .in('id', engagementIds)
        if (engagementDelete.error) cleanupErrors.push(engagementDelete.error.message)
      }
    }
    if (leadId) {
      const result = await admin.from('leads').delete().eq('id', leadId)
      if (result.error) cleanupErrors.push(result.error.message)
    }
    if (clientId) {
      const result = await admin.from('clients').delete().eq('id', clientId)
      if (result.error) cleanupErrors.push(result.error.message)
    }
    if (authUserId) {
      const result = await admin.auth.admin.deleteUser(authUserId)
      if (result.error) cleanupErrors.push(result.error.message)
    }
    if (cleanupErrors.length > 0) {
      throw new Error(`Falha ao limpar dados temporários P2: ${cleanupErrors.join(' | ')}`)
    }
  })

  test('valida os quatro serviços, transições, histórico funcional e responsividade', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(testEmail)
    await page.locator('#password').fill(testPassword)
    await page.getByRole('button', { name: /Entrar na plataforma/i }).click()
    await page.waitForURL('**/dashboard')

    const conversion = await browserJson(page, `/api/leads/${leadId}/status`, 'PATCH', {
      status: 'convertido',
      selectedServices: [...SERVICES],
    })
    expect(conversion.status, JSON.stringify(conversion.body)).toBe(200)
    clientId = String(conversion.body.convertedClientId ?? '')
    expect(clientId).not.toBe('')
    expect(conversion.body.serviceProcessIds).toHaveLength(4)

    const { data: client, error: clientError } = await admin
      .from('clients')
      .select('name, phone, email, client_type, disability_types, cnh_restrictions, receives_loas_bpc, has_medical_report, internal_notes')
      .eq('id', clientId)
      .single()
    if (clientError) throw clientError
    expect(client.name).toBe(testName)
    expect(client.email).toBe(testEmail)
    expect(client.client_type).toBe('condutor')
    expect([...client.disability_types].sort()).toEqual(['auditiva', 'fisica'])
    expect(client.cnh_restrictions).toEqual(['B'])
    expect(client.receives_loas_bpc).toBe(true)
    expect(client.has_medical_report).toBe(true)
    expect(client.internal_notes).toBe(longNotes.trim())

    const { data: engagement, error: engagementError } = await admin
      .from('client_service_engagements')
      .select('id')
      .eq('client_id', clientId)
      .eq('origin_lead_id', leadId)
      .single()
    if (engagementError) throw engagementError
    const { data: planItems, error: planError } = await admin
      .from('client_service_plan_items')
      .select('service_key, status, process_id, sort_order')
      .eq('engagement_id', engagement.id)
      .order('sort_order')
    if (planError) throw planError
    expect(planItems?.map(item => item.service_key)).toEqual([...SERVICES])
    expect(planItems?.every(item => Boolean(item.process_id))).toBe(true)

    let processes = await getProcesses()
    expect(processes.size).toBe(4)
    expect(processes.get('cnh_especial')?.status).toBe('em_andamento')
    expect(processes.get('processo_ipva')?.status).toBe('em_andamento')
    expect(processes.get('processo_ipi')?.status).toBe('aberto')
    expect(processes.get('processo_ipi')?.blocked_reason).toContain('CNH Especial')
    expect(processes.get('processo_icms')?.status).toBe('aberto')
    expect(processes.get('processo_icms')?.blocked_reason).toContain('IPI')
    expect([...processes.values()].every(process => process.vehicle_id === null)).toBe(true)

    const { data: dependencyWallet, error: dependencyWalletError } = await admin
      .from('process_wallet_rows')
      .select('operational_situation')
      .eq('process_id', processes.get('processo_ipi')!.id)
      .single()
    if (dependencyWalletError) throw dependencyWalletError
    hasMigration033 = dependencyWallet.operational_situation === 'aguardando_dependencia'

    await page.goto('/dashboard')
    await expect(page.getByText('Aguardando dependência', { exact: true }).first()).toBeVisible()
    await page.goto('/rotina?tipo=aguardando_dependencia')
    await expect(page.getByText(testName).first()).toBeVisible()
    await page.goto('/processos/tipo/processo_ipi')
    await expect(page.locator('select[name="situacao"] option[value="aguardando_dependencia"]')).toHaveText('Aguardando serviço anterior')

    const cnh = processes.get('cnh_especial')!
    const cnhIssuance = await getStage(cnh.id, 'emissao_cnh')
    const cnhCompletion = await browserJson(page, `/api/processos/${cnh.id}/stages/${cnhIssuance.id}`, 'PATCH', {
      status: 'concluido',
      scheduledDate: null,
      attended: null,
      result: null,
      notes: `CNH concluída no ensaio ${marker}`,
      data: { restricoes: 'B, D', vencimento_cnh: cnhExpiry },
      notifyClient: false,
    })
    expect(cnhCompletion.status, JSON.stringify(cnhCompletion.body)).toBe(200)

    processes = await getProcesses()
    expect(processes.get('cnh_especial')?.status).toBe('concluido')
    expect(processes.get('processo_ipi')?.status).toBe('em_andamento')
    if (!hasMigration033 && processes.get('processo_ipi')?.blocked_reason) {
      const { error } = await admin.from('processes').update({
        blocked_reason: null,
        next_action: 'Iniciar atendimento',
        action_owner: 'equipe',
      }).eq('id', processes.get('processo_ipi')!.id)
      if (error) throw error
      processes = await getProcesses()
    }
    expect(processes.get('processo_ipi')?.blocked_reason).toBeNull()

    const ipi = processes.get('processo_ipi')!
    const ipiDecision = await getStage(ipi.id, 'protocolo_sisen_ipi')
    const ipiApproval = await browserJson(page, `/api/processos/${ipi.id}/stages/${ipiDecision.id}`, 'PATCH', {
      status: 'aprovado',
      scheduledDate: null,
      attended: null,
      result: 'deferido',
      notes: `IPI deferido no ensaio ${marker}`,
      data: {
        purchase_only_with_ipi: 'nao',
        protocol: `IPI-${marker}`,
        protocol_date: today,
        request_scope: 'ipi',
        operational_status: 'deferido',
      },
      notifyClient: false,
    })
    expect(ipiApproval.status, JSON.stringify(ipiApproval.body)).toBe(200)

    processes = await getProcesses()
    expect(processes.get('processo_ipi')?.status).toBe('concluido')
    expect(processes.get('processo_icms')?.status).toBe('em_andamento')
    if (!hasMigration033 && processes.get('processo_icms')?.blocked_reason) {
      const { error } = await admin.from('processes').update({
        blocked_reason: null,
        next_action: 'Iniciar atendimento',
        action_owner: 'equipe',
      }).eq('id', processes.get('processo_icms')!.id)
      if (error) throw error
      processes = await getProcesses()
    }
    expect(processes.get('processo_icms')?.blocked_reason).toBeNull()

    const icms = processes.get('processo_icms')!
    await page.goto(`/processos/${icms.id}`)
    const icmsCard = page.getByRole('button', { name: /Protocolo de ICMS/i }).locator('..')
    await icmsCard.getByRole('button', { name: /Protocolo de ICMS/i }).click()
    await icmsCard.getByLabel('Número do protocolo *', { exact: true }).fill(`ICMS-${marker}`)
    await icmsCard.getByLabel('Data do protocolo *', { exact: true }).fill(today)
    await icmsCard.getByLabel('Concessionária', { exact: true }).fill('Concessionária E2E')
    await icmsCard.getByLabel('Vendedor da concessionária', { exact: true }).fill('Vendedor E2E')
    await icmsCard.getByLabel('Marca', { exact: true }).fill('Marca E2E')
    await icmsCard.getByLabel('Modelo', { exact: true }).fill('Modelo E2E')
    await icmsCard.getByLabel('Valor do veículo', { exact: true }).fill('120000.50')
    await icmsCard.getByLabel('Data da compra', { exact: true }).fill(today)
    await icmsCard.getByLabel('Próxima troca prevista', { exact: true }).fill(nextVehicleChange)
    await icmsCard.getByLabel('Cliente comunicado?', { exact: true }).check()
    await icmsCard.getByLabel(/Cliente autorizou o envio/).check()
    await icmsCard.getByRole('button', { name: 'Deferido', exact: true }).click()

    let ipvaOfferSeen = false
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ICMS deferido. Dar entrada no IPVA agora?')
      ipvaOfferSeen = true
      await dialog.accept()
    })
    await icmsCard.getByRole('button', { name: 'Salvar etapa', exact: true }).click()
    await expect.poll(() => ipvaOfferSeen).toBe(true)

    await expect.poll(async () => {
      const stage = await getStage(icms.id, 'protocolo_sivei_icms')
      return `${stage.status}:${stage.result}`
    }).toBe('aprovado:deferido')

    const { data: purchases, error: purchaseError } = await admin
      .from('client_vehicle_purchases')
      .select('dealership, salesperson, brand, model, vehicle_price, purchase_date, next_vehicle_change_date')
      .eq('client_id', clientId)
      .eq('process_id', icms.id)
    if (purchaseError) throw purchaseError
    expect(purchases).toHaveLength(1)
    expect(purchases?.[0]).toMatchObject({
      dealership: 'Concessionária E2E',
      salesperson: 'Vendedor E2E',
      brand: 'Marca E2E',
      model: 'Modelo E2E',
      purchase_date: today,
      next_vehicle_change_date: nextVehicleChange,
    })

    processes = await getProcesses()
    expect([...processes.values()].filter(process => process.process_type_id === processTypes.get('processo_ipva'))).toHaveLength(1)
    const { data: completeRow, error: completeError } = await admin
      .from('client_complete_rows')
      .select('indication_name, dealership, salesperson, purchase_date, next_vehicle_change_date, cnh_process_status')
      .eq('client_id', clientId)
      .single()
    if (completeError) throw completeError
    expect(completeRow.indication_name).toBeNull()
    expect(completeRow.dealership).toBe('Concessionária E2E')
    expect(completeRow.salesperson).toBe('Vendedor E2E')
    expect(completeRow.cnh_process_status).toBe('concluido')

    const responsiveRoutes = [
      `/clientes/${clientId}`,
      '/processos/tipo/cnh_especial',
      `/processos/${icms.id}`,
      '/dashboard',
      '/rotina',
    ]
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      for (const route of responsiveRoutes) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        await assertNoPageOverflow(page)
      }
    }

    await page.goto(`/clientes/${clientId}`)
    await expect(page.getByRole('heading', { name: testName, exact: true })).toBeVisible()
  })
})
