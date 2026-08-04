import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationUrl = new URL(
  '../../supabase/migrations/033_p2_transition_audit_and_operational_visibility.sql',
  import.meta.url,
)

test('migration P2 separa dependências e remove o avanço legado por ordem global', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /DROP TRIGGER IF EXISTS activate_next_client_service_process/i)
  assert.match(sql, /CREATE OR REPLACE VIEW public\.process_wallet_rows/i)
  assert.match(sql, /'aguardando_dependencia'/i)
  assert.match(sql, /LIKE 'aguardando conclusão%'/i)
  assert.match(sql, /prerequisite_item\.status = 'concluido'/i)
  assert.match(sql, /UPDATE public\.processes successor/i)
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.validate_service_plan_item/i)
  assert.match(sql, /IF NOT FOUND THEN RETURN NEW; END IF;/i)
})

test('migration P2 audita liberações, veículo e decisões do cliente', async () => {
  const sql = await readFile(migrationUrl, 'utf8')

  assert.match(sql, /audit_process_operational_changes/i)
  assert.match(sql, /liberado automaticamente/i)
  assert.match(sql, /Veículo vinculado posteriormente/i)
  assert.match(sql, /profile\.id = NEW\.responsible_user_id/i)
  assert.match(sql, /profile\.role IN \('super_admin', 'admin'\)/i)
  assert.doesNotMatch(sql, /PERFORM public\.workflow_notify_process/i)
  assert.match(sql, /client_notified/i)
  assert.match(sql, /documents_release_authorized/i)
  assert.match(sql, /purchase_only_with_ipi/i)
})
