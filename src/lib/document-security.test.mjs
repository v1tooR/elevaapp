import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedDocumentUrl } from './document-security.ts'

test('aceita somente links HTTPS dos hosts oficiais do Google Drive', () => {
  assert.equal(isAllowedDocumentUrl('https://drive.google.com/file/d/abc/view'), true)
  assert.equal(isAllowedDocumentUrl('https://docs.google.com/document/d/abc/edit'), true)
  assert.equal(isAllowedDocumentUrl('http://drive.google.com/file/d/abc/view'), false)
})

test('rejeita domínios parecidos, credenciais na URL e entradas inválidas', () => {
  assert.equal(isAllowedDocumentUrl('https://drive.google.com.evil.test/file'), false)
  assert.equal(isAllowedDocumentUrl('https://drive.google.com@evil.test/file'), false)
  assert.equal(isAllowedDocumentUrl('javascript:alert(1)'), false)
  assert.equal(isAllowedDocumentUrl('não é uma URL'), false)
})
