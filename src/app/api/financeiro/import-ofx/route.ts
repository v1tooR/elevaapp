import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 2 * 1024 * 1024

function readTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i'))
  return match?.[1]?.trim() ?? ''
}

function decodeText(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function parseOFX(source: string) {
  const transactions: {
    fitid: string
    type: 'INCOME' | 'EXPENSE'
    amount: number
    date: string
    description: string
  }[] = []

  const transactionPattern = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>)|$)/gi
  let match: RegExpExecArray | null
  let index = 0

  while ((match = transactionPattern.exec(source)) !== null) {
    const block = match[1]
    const rawAmount = Number(readTag(block, 'TRNAMT').replace(',', '.'))
    const date = parseDate(readTag(block, 'DTPOSTED'))

    if (!Number.isFinite(rawAmount) || rawAmount === 0 || !date) continue

    const name = decodeText(readTag(block, 'NAME'))
    const memo = decodeText(readTag(block, 'MEMO'))
    const checkNumber = decodeText(readTag(block, 'CHECKNUM'))
    const description = name || memo || checkNumber || 'Lançamento importado'
    const fitid = readTag(block, 'FITID') || `${date}-${Math.abs(rawAmount)}-${index}`

    transactions.push({
      fitid,
      type: rawAmount > 0 ? 'INCOME' : 'EXPENSE',
      amount: Math.abs(rawAmount),
      date,
      description: description.slice(0, 180),
    })
    index += 1
  }

  return transactions
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Selecione um arquivo OFX ou QFX.' }, { status: 400 })
  }

  const extension = file.name.toLowerCase().split('.').pop()
  if (!extension || !['ofx', 'qfx'].includes(extension)) {
    return NextResponse.json({ error: 'Formato inválido. Envie um arquivo .OFX ou .QFX.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'O arquivo deve ter no máximo 2 MB.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const utf8Source = new TextDecoder('utf-8').decode(buffer)
  const isUtf8 = /ENCODING\s*:\s*UTF-?8/i.test(utf8Source) || /encoding=["']UTF-?8["']/i.test(utf8Source)
  const source = isUtf8 ? utf8Source : new TextDecoder('windows-1252').decode(buffer)
  const transactions = parseOFX(source)

  if (transactions.length === 0) {
    return NextResponse.json({ error: 'Nenhuma transação válida foi encontrada no arquivo.' }, { status: 400 })
  }

  return NextResponse.json({ transactions })
}
