import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sourceUrls = {
  stageApi: new URL('../app/api/processos/[id]/stages/[stageId]/route.ts', import.meta.url),
  newProcess: new URL('../app/processos/novo/page.tsx', import.meta.url),
  vehicleManager: new URL('../components/clientes/vehicle-manager.tsx', import.meta.url),
  vehicleApi: new URL('../app/api/clientes/[id]/veiculos/route.ts', import.meta.url),
}

test('ICMS e IPVA podem iniciar e concluir sem veículo vinculado', async () => {
  const [stageApi, newProcess] = await Promise.all([
    readFile(sourceUrls.stageApi, 'utf8'),
    readFile(sourceUrls.newProcess, 'utf8'),
  ])

  assert.doesNotMatch(stageApi, /isIcmsProtocol/)
  assert.doesNotMatch(stageApi, /marca e o modelo no Protocolo de ICMS/)
  assert.doesNotMatch(stageApi, /isIpvaProtocol/)
  assert.doesNotMatch(stageApi, /Vincule o veículo ao processo antes de concluir o protocolo do IPVA/)
  assert.match(newProcess, /Veículo \(opcional nesta etapa\)/)
  assert.doesNotMatch(newProcess, /vehicle_id[^\n]*(?:required|obrigat)/i)
})

test('cadastro novo de veículo omite descrição e chassi', async () => {
  const source = await readFile(sourceUrls.vehicleManager, 'utf8')

  assert.doesNotMatch(source, /form\.description|form\.chassis/)
  assert.doesNotMatch(source, /label="(?:Descrição|Descricao|Chassi)"/)
  assert.match(source, /label="Marca"/)
  assert.match(source, /label="Modelo"/)
  assert.match(source, /label="Placa"/)
  assert.match(source, /label="RENAVAM"/)
})

test('API aceita marca e modelo ou uma identificação oficial', async () => {
  const source = await readFile(sourceUrls.vehicleApi, 'utf8')

  assert.match(source, /hasBrandAndModel = Boolean\(value\.brand\?\.trim\(\) && value\.model\?\.trim\(\)\)/)
  assert.match(source, /hasOfficialIdentifier = Boolean\(value\.plate\?\.trim\(\) \|\| value\.renavam\?\.trim\(\)\)/)
  assert.doesNotMatch(source, /description:\s*optionalText|chassis:\s*z\./)
  assert.match(source, /description:\s*null/)
  assert.match(source, /chassis:\s*null/)
})
