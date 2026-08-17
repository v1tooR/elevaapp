export type OperationalStageStatus = 'pendente' | 'em_andamento' | 'concluido' | 'aprovado' | 'reprovado' | 'nao_aplicavel'

export type OperationalFieldOption = {
  value: string
  label: string
}

export type OperationalFieldDefinition = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'date' | 'select' | 'boolean' | 'number'
  options?: OperationalFieldOption[]
  placeholder?: string
  help?: string
  requiredOnResolve?: boolean
  mustBeTrueOnResolve?: boolean
  /**
   * Use a etapa `key` para comparar um campo do formulário ou
   * `RESULT_FIELD_KEY` para depender do resultado escolhido na decisão.
   */
  visibleWhen?: { key: string; equals: unknown }
}

/** Chave especial de `visibleWhen` que aponta para o resultado da etapa. */
export const RESULT_FIELD_KEY = '__result'

export type OperationalChecklistItem = {
  key: string
  label: string
  requiredOnResolve?: boolean
}

export type OperationalResultOption = {
  value: string
  label: string
  stageStatus: Extract<OperationalStageStatus, 'concluido' | 'aprovado' | 'reprovado'>
}

export type OperationalStageTemplate = {
  stage_key: string
  label: string
  description: string
  sort_order: number
  initialStatus?: OperationalStageStatus
  initialData?: Record<string, unknown>
  allowedStatuses?: OperationalStageStatus[]
  statusLabels?: Partial<Record<OperationalStageStatus, string>>
  fields?: OperationalFieldDefinition[]
  checklist?: OperationalChecklistItem[]
  hasScheduledDate?: boolean
  scheduledDateRequiredOnResolve?: boolean
  hasAttendance?: boolean
  resultOptions?: OperationalResultOption[]
  activateOnRejected?: string
  activateOnApproved?: string
  /** Etapa em que a entrada é dada. Tudo antes dela é recebimento de documentos. */
  entryStage?: boolean
}

export type OperationalWorkflowSource = {
  title: string
  url: string
}

export type OperationalWorkflowDefinition = {
  slug: string
  title: string
  scopeNote: string
  sources: OperationalWorkflowSource[]
  stages: OperationalStageTemplate[]
}

const STANDARD_STATUSES: OperationalStageStatus[] = ['pendente', 'em_andamento', 'concluido', 'nao_aplicavel']
const DECISION_STATUSES: OperationalStageStatus[] = ['pendente', 'em_andamento', 'aprovado', 'reprovado']
const YES_NO_OPTIONS: OperationalFieldOption[] = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
]
const BRAZIL_STATE_OPTIONS: OperationalFieldOption[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
].map(value => ({ value, label: value }))
const REQUEST_STATUS_OPTIONS: OperationalFieldOption[] = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_preparacao', label: 'Em preparação' },
  { value: 'protocolado', label: 'Protocolado' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'exigencia', label: 'Com exigência/pendência' },
  { value: 'deferido', label: 'Deferido' },
  { value: 'indeferido', label: 'Indeferido' },
]
export const SEFAZ_STATUS_OPTIONS: OperationalFieldOption[] = [
  { value: 'nao_protocolado', label: 'Pedido ainda não protocolado' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'exigencia', label: 'Com exigência/pendência' },
  { value: 'aguardando_acao_usuario', label: 'Aguardando ação do usuário' },
  { value: 'deferido', label: 'Deferido' },
  { value: 'deferido_com_condicao', label: 'Deferido com condição' },
  { value: 'indeferido', label: 'Indeferido' },
  { value: 'recurso_em_andamento', label: 'Recurso em andamento' },
]

export const IPI_DETRAN_REPORT_STATUS_VALUES = [
  'nao_solicitado',
  'solicitado',
  'em_andamento',
  'pronto',
  'nao_aplicavel',
] as const

export type IpiDetranReportStatus = typeof IPI_DETRAN_REPORT_STATUS_VALUES[number]

export const IPI_DETRAN_REPORT_STATUS_OPTIONS: OperationalFieldOption[] = [
  { value: 'nao_solicitado', label: 'Não iniciado' },
  { value: 'solicitado', label: 'Solicitado' },
  { value: 'pronto', label: 'Recebido' },
]

export function getIpiDetranStageStatus(
  reportStatus: IpiDetranReportStatus,
): OperationalStageStatus {
  if (reportStatus === 'pronto') return 'concluido'
  if (reportStatus === 'nao_aplicavel') return 'nao_aplicavel'
  if (reportStatus === 'solicitado' || reportStatus === 'em_andamento') return 'em_andamento'
  return 'pendente'
}

export function getIpiDetranReportStatus(
  data: Record<string, unknown> | null | undefined,
  stageStatus?: string | null,
): IpiDetranReportStatus {
  const reportStatus = data?.report_status
  if (
    typeof reportStatus === 'string'
    && IPI_DETRAN_REPORT_STATUS_VALUES.includes(reportStatus as IpiDetranReportStatus)
  ) {
    if (reportStatus === 'em_andamento') return 'solicitado'
    if (reportStatus === 'nao_aplicavel') return 'nao_solicitado'
    return reportStatus as IpiDetranReportStatus
  }
  if (stageStatus === 'concluido' || stageStatus === 'aprovado') return 'pronto'
  if (stageStatus === 'nao_aplicavel') return 'nao_aplicavel'
  if (stageStatus === 'em_andamento') return 'em_andamento'
  return 'nao_solicitado'
}

export function isOperationalStageBlocked(data: Record<string, unknown> | null | undefined) {
  return typeof data?.blocked_by === 'string' && data.blocked_by.length > 0
}

const COMMON_DECISION_RESULTS: OperationalResultOption[] = [
  { value: 'deferido', label: 'Deferido', stageStatus: 'aprovado' },
  { value: 'indeferido', label: 'Indeferido', stageStatus: 'reprovado' },
]

const CLIENT_NOTIFIED_FIELD: OperationalFieldDefinition = {
  key: 'client_notified',
  label: 'Cliente comunicado?',
  type: 'boolean',
  mustBeTrueOnResolve: true,
}

const PROTOCOL_FIELDS: OperationalFieldDefinition[] = [
  { key: 'protocol', label: 'Número do protocolo', type: 'text', requiredOnResolve: true },
  { key: 'protocol_date', label: 'Data do protocolo', type: 'date', requiredOnResolve: true },
]

const WORKFLOWS: Record<string, OperationalWorkflowDefinition> = {
  processo_ipi: {
    slug: 'processo_ipi',
    title: 'Isenção de IPI — aquisição de veículo',
    scopeNote: 'Fluxo federal pelo SISEN. O IPI pode alcançar condutor e não condutor conforme os requisitos da Receita Federal.',
    sources: [
      { title: 'Serviço oficial SISEN — IPI/IOF', url: 'https://www.gov.br/pt-br/servicos/obter-isencao-de-impostos-para-comprar-carro' },
      { title: 'Perguntas frequentes da Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/isencao-para-compra-de-carro/isencao-para-compra-de-carro' },
    ],
    stages: [
      {
        stage_key: 'laudo_ipi', label: 'Laudo DETRAN', sort_order: 10,
        description: 'Controle a solicitação e a emissão do Laudo DETRAN. Ao ficar pronto, a documentação do IPI será liberada automaticamente.',
        initialData: { report_status: 'nao_solicitado' },
        fields: [
          {
            key: 'report_status',
            label: 'Situação do laudo',
            type: 'select',
            options: IPI_DETRAN_REPORT_STATUS_OPTIONS,
            help: '“Recebido” libera automaticamente a próxima etapa e avisa o cliente.',
          },
        ],
      },
      {
        stage_key: 'documentos_ipi', label: 'Checklist do IPI', sort_order: 20,
        description: 'Liberada quando o Laudo DETRAN for recebido. A exigência final deve seguir o perfil do cliente no SISEN.',
        initialData: { blocked_by: 'laudo_ipi' },
        checklist: [
          { key: 'identificacao_cpf', label: 'Documento de identificação e CPF' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'condutores', label: 'Condutor(es) habilitado(s), quando o beneficiário não conduz', requiredOnResolve: false },
          { key: 'representacao_legal', label: 'Representação legal/procuração, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'protocolo_sisen_ipi', label: 'Protocolo do IPI', sort_order: 30, entryStage: true,
        description: 'Registrar protocolo, acompanhamento e decisão sem armazenar credenciais do portal.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'recurso_ipi',
        fields: [
          { key: 'purchase_only_with_ipi', label: 'Cliente comprará somente com IPI?', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS, help: 'Se a resposta for “Não”, o ICMS contratado será liberado automaticamente.' },
          ...PROTOCOL_FIELDS,
          { key: 'request_scope', label: 'Escopo do pedido', type: 'select', requiredOnResolve: true, options: [
            { value: 'ipi', label: 'Somente IPI' }, { value: 'ipi_iof', label: 'IPI e IOF' },
          ] },
          { key: 'operational_status', label: 'Situação no SISEN', type: 'select', options: REQUEST_STATUS_OPTIONS },
          { key: 'requirement_details', label: 'Exigência ou pendência', type: 'textarea' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea' },
        ],
      },
      {
        stage_key: 'recurso_ipi', label: 'Recurso administrativo', sort_order: 40,
        description: 'Usar quando houver indeferimento e decisão de recorrer.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: [...STANDARD_STATUSES, 'aprovado', 'reprovado'],
        fields: [
          ...PROTOCOL_FIELDS,
          { key: 'due_date', label: 'Prazo registrado', type: 'date' },
          { key: 'grounds', label: 'Fundamentos e observações', type: 'textarea' },
          { key: 'outcome', label: 'Resultado do recurso', type: 'textarea' },
        ],
      },
    ],
  },

  processo_iof: {
    slug: 'processo_iof',
    title: 'Isenção de IOF — aquisição de veículo',
    scopeNote: 'Benefício federal mais restrito que o IPI: a validação deve confirmar deficiência física, CNH compatível e laudo do DETRAN.',
    sources: [
      { title: 'Serviço oficial SISEN — IPI/IOF', url: 'https://www.gov.br/pt-br/servicos/obter-isencao-de-impostos-para-comprar-carro' },
      { title: 'Perguntas frequentes da Receita Federal', url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/isencao-para-compra-de-carro/isencao-para-compra-de-carro' },
    ],
    stages: [
      {
        stage_key: 'elegibilidade_iof', label: 'Elegibilidade específica do IOF', sort_order: 10,
        description: 'Não presumir elegibilidade apenas porque o IPI foi aprovado.',
        fields: [
          { key: 'physical_disability_confirmed', label: 'Deficiência física confirmada', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
          { key: 'restricted_cnh_confirmed', label: 'CNH com restrições compatíveis', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
          { key: 'first_iof_exemption', label: 'Nunca utilizou a isenção de IOF', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
        ],
      },
      {
        stage_key: 'documentos_iof', label: 'Documentos do IOF', sort_order: 20,
        description: 'Reunir a documentação específica do benefício.',
        checklist: [
          { key: 'identificacao_cpf', label: 'Documento de identificação e CPF' },
          { key: 'cnh_restrita', label: 'CNH com restrições' },
          { key: 'laudo_detran', label: 'Laudo emitido pelo DETRAN do estado de residência' },
        ],
      },
      {
        stage_key: 'protocolo_sisen_iof', label: 'Protocolo no SISEN', sort_order: 30, entryStage: true,
        description: 'Registrar o pedido no SISEN sem armazenar credenciais.',
        fields: [...PROTOCOL_FIELDS, { key: 'operational_status', label: 'Situação no SISEN', type: 'select', options: REQUEST_STATUS_OPTIONS }],
      },
      {
        stage_key: 'decisao_iof', label: 'Decisão da Receita Federal', sort_order: 40,
        description: 'Registrar decisão, ciência e eventual motivo de indeferimento.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'recurso_iof',
        fields: [
          { key: 'decision_notified_at', label: 'Data da ciência', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea' },
        ],
      },
      {
        stage_key: 'recurso_iof', label: 'Recurso administrativo', sort_order: 50,
        description: 'Avaliar recurso somente quando houver fundamento e autorização do cliente.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: [...STANDARD_STATUSES, 'aprovado', 'reprovado'],
        fields: [...PROTOCOL_FIELDS, { key: 'grounds', label: 'Fundamentos', type: 'textarea' }, { key: 'outcome', label: 'Resultado', type: 'textarea' }],
      },
    ],
  },

  processo_icms: {
    slug: 'processo_icms',
    title: 'Isenção de ICMS — veículo novo',
    scopeNote: 'Template operacional para São Paulo (SIVEI). Em outra UF, confirme documentos, limites e procedimento local antes de protocolar.',
    sources: [
      { title: 'SEFAZ-SP — Isenção de ICMS para veículos', url: 'https://portal.fazenda.sp.gov.br/servicos/isencao-icms-veiculos/Paginas/Sobre.aspx' },
      { title: 'SEFAZ-SP — Guia do usuário', url: 'https://portal.fazenda.sp.gov.br/servicos/isencao-icms-veiculos/Paginas/PaginaGuiaDoUsuario.aspx' },
    ],
    stages: [
      {
        stage_key: 'pre_requisitos_icms', label: 'Checklist do ICMS', sort_order: 10,
        description: 'Reunir os pré-requisitos e documentos do pedido. Ao finalizar o checklist, o processo passa a pedir “Dar entrada”.',
        initialData: { state_scope: 'sp', state: 'SP' },
        allowedStatuses: ['pendente', 'em_andamento', 'concluido'],
        statusLabels: {
          pendente: 'Não iniciado',
          em_andamento: 'Aguardando documentos',
          concluido: 'Checklist concluído — dar entrada',
        },
        checklist: [
          { key: 'autorizacao_ipi', label: 'Autorização do IPI válida' },
          { key: 'laudo', label: 'Laudo DETRAN atualizado' },
          { key: 'anexo_ii', label: 'Anexo II/requerimento aplicável' },
          { key: 'comprovante_renda', label: 'Comprovante de renda' },
          { key: 'forma_pagamento', label: 'Comprovante da forma de pagamento' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'procuracao', label: 'Procuração, quando aplicável', requiredOnResolve: false },
        ],
        fields: [
          { key: 'state_scope', label: 'UF do pedido', type: 'select', requiredOnResolve: true, options: [
            { value: 'sp', label: 'São Paulo' }, { value: 'outro', label: 'Outro estado' },
          ] },
          { key: 'state', label: 'Selecione a UF', type: 'select', requiredOnResolve: true, options: BRAZIL_STATE_OPTIONS.filter(option => option.value !== 'SP'), visibleWhen: { key: 'state_scope', equals: 'outro' } },
        ],
      },
      {
        stage_key: 'protocolo_sivei_icms', label: 'Dar entrada no ICMS', sort_order: 20, entryStage: true,
        description: 'Dar entrada no pedido e acompanhar até a decisão. Protocolado e “em análise” são a mesma situação. Se for deferido, confirme a comunicação e a autorização do cliente; se for indeferido, use a etapa de novo protocolo.',
        allowedStatuses: DECISION_STATUSES,
        statusLabels: {
          pendente: 'Dar entrada',
          em_andamento: 'Protocolado — em análise',
          aprovado: 'Deferido',
          reprovado: 'Indeferido',
        },
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'recurso_icms',
        activateOnApproved: 'nota_fiscal_icms',
        fields: [
          { key: 'protocol', label: 'Número do protocolo', type: 'text', requiredOnResolve: true },
          { key: 'protocol_date', label: 'Data da entrada', type: 'date', requiredOnResolve: true },
          { key: 'dealership', label: 'Concessionária', type: 'text', requiredOnResolve: true },
          { key: 'salesperson', label: 'Vendedor da concessionária', type: 'text', requiredOnResolve: true },
          { key: 'vehicle', label: 'Marca/modelo escolhido', type: 'text', help: 'Informe aqui ou use os campos separados de marca e modelo antes do protocolo.' },
          { key: 'brand', label: 'Marca', type: 'text' },
          { key: 'model', label: 'Modelo', type: 'text' },
          { key: 'chassis', label: 'Chassi', type: 'text', help: 'Preencha quando a concessionária disponibilizar.' },
          { key: 'license_plate', label: 'Placa', type: 'text', help: 'Pode permanecer em branco antes do emplacamento.' },
          { key: 'renavam', label: 'RENAVAM', type: 'text', help: 'Pode permanecer em branco enquanto ainda não existir.' },
          { key: 'vehicle_price', label: 'Valor do veículo', type: 'number' },
          { key: 'purchase_date', label: 'Data da compra', type: 'date' },
          { key: 'next_vehicle_change_date', label: 'Próxima troca prevista', type: 'date' },
          { key: 'requirement_details', label: 'Exigência/pendência', type: 'textarea' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea', visibleWhen: { key: RESULT_FIELD_KEY, equals: 'indeferido' } },
          { ...CLIENT_NOTIFIED_FIELD, visibleWhen: { key: RESULT_FIELD_KEY, equals: 'deferido' } },
          {
            key: 'documents_release_authorized',
            label: 'Cliente autorizou o envio dos documentos para a concessionária?',
            type: 'boolean',
            mustBeTrueOnResolve: true,
            visibleWhen: { key: RESULT_FIELD_KEY, equals: 'deferido' },
          },
        ],
      },
      {
        stage_key: 'nota_fiscal_icms', label: 'Nota fiscal do veículo', sort_order: 25,
        description: 'Liberada quando o ICMS é deferido. Acompanhar a emissão da nota fiscal pela concessionária.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: ['pendente', 'em_andamento', 'concluido', 'nao_aplicavel'],
        statusLabels: {
          pendente: 'Aguardando nota fiscal',
          em_andamento: 'Nota fiscal solicitada',
          concluido: 'Nota fiscal recebida',
          nao_aplicavel: 'Não aplicável',
        },
        fields: [
          { key: 'invoice_number', label: 'Número da nota fiscal', type: 'text', requiredOnResolve: true },
          { key: 'invoice_issued_at', label: 'Data de emissão da nota fiscal', type: 'date', requiredOnResolve: true },
          CLIENT_NOTIFIED_FIELD,
        ],
      },
      {
        stage_key: 'recurso_icms', label: 'Dar entrada novamente ou recorrer', sort_order: 30,
        description: 'Liberada quando o ICMS é indeferido. O caminho padrão é dar entrada novamente com a pendência corrigida.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: [...STANDARD_STATUSES, 'aprovado', 'reprovado'],
        statusLabels: {
          pendente: 'Não iniciado',
          em_andamento: 'Em análise',
          concluido: 'Finalizado',
          aprovado: 'Deferido',
          reprovado: 'Indeferido',
          nao_aplicavel: 'Não aplicável',
        },
        fields: [
          { key: 'action', label: 'Providência', type: 'select', requiredOnResolve: true, options: [
            { value: 'novo_pedido', label: 'Dar entrada novamente' }, { value: 'recurso', label: 'Interpor recurso' }, { value: 'encerrar', label: 'Encerrar sem nova medida' },
          ] },
          { key: 'protocol', label: 'Número do novo protocolo/recurso', type: 'text' },
          { key: 'protocol_date', label: 'Data do novo protocolo/recurso', type: 'date' },
          { key: 'grounds', label: 'Motivo/fundamentos', type: 'textarea' },
          { key: 'outcome', label: 'Resultado', type: 'textarea' },
          CLIENT_NOTIFIED_FIELD,
        ],
      },
    ],
  },

  processo_ipva: {
    slug: 'processo_ipva',
    title: 'Isenção de IPVA — veículo da pessoa com deficiência',
    scopeNote: 'Fluxo estadual e independente: assim que o veículo tem placa e marca, o IPVA pode andar sozinho, sem esperar IPI, ICMS ou perícia.',
    sources: [
      { title: 'SEFAZ-SP — Isenção de IPVA', url: 'https://portal.fazenda.sp.gov.br/servicos/ipva/Paginas/Isencao.aspx' },
    ],
    stages: [
      {
        stage_key: 'veiculo_ipva', label: 'Veículo do pedido', sort_order: 4,
        description: 'Placa e marca liberam o IPVA. Enquanto faltarem, o pedido não pode ser protocolado.',
        statusLabels: {
          pendente: 'Aguardando placa e marca',
          em_andamento: 'Dados incompletos',
          concluido: 'Veículo liberado',
        },
        allowedStatuses: ['pendente', 'em_andamento', 'concluido'],
        fields: [
          { key: 'license_plate', label: 'Placa', type: 'text', requiredOnResolve: true, help: 'Junto com a marca, libera o IPVA para seguir sozinho.' },
          { key: 'brand', label: 'Marca', type: 'text', requiredOnResolve: true },
          { key: 'model', label: 'Modelo', type: 'text' },
          { key: 'renavam', label: 'RENAVAM', type: 'text' },
          { key: 'vehicle_condition', label: 'Condição do veículo', type: 'select', requiredOnResolve: true, options: [
            { value: 'zero_km', label: 'Zero-quilômetro' }, { value: 'usado', label: 'Usado' },
          ] },
          {
            key: 'invoice_issued_at',
            label: 'Data de emissão da nota fiscal',
            type: 'date',
            requiredOnResolve: true,
            visibleWhen: { key: 'vehicle_condition', equals: 'zero_km' },
            help: 'Obrigatória para veículo zero-quilômetro.',
          },
        ],
      },
      {
        stage_key: 'documentos_ipva', label: 'Checklist do IPVA', sort_order: 6,
        description: 'Reunir os documentos do pedido. Ao finalizar o checklist, o processo passa a pedir “Dar entrada”.',
        allowedStatuses: ['pendente', 'em_andamento', 'concluido'],
        statusLabels: {
          pendente: 'Não iniciado',
          em_andamento: 'Aguardando documentos',
          concluido: 'Checklist concluído — dar entrada',
        },
        checklist: [
          { key: 'identificacao_cpf', label: 'Documento de identificação e CPF' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'documento_veiculo', label: 'Documento do veículo ou nota fiscal' },
          { key: 'laudo', label: 'Laudo/perícia exigido pelo estado' },
          { key: 'procuracao', label: 'Procuração ou representação legal, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'sivei_protocolo', label: 'Protocolo do IPVA', sort_order: 10, entryStage: true,
        description: 'Dar entrada no pedido de isenção junto ao estado e registrar o número e a data do protocolo.',
        allowedStatuses: ['pendente', 'em_andamento', 'concluido'],
        statusLabels: {
          pendente: 'Dar entrada',
          em_andamento: 'Entrada em preparação',
          concluido: 'Protocolado — em análise',
        },
        fields: [...PROTOCOL_FIELDS],
      },
      {
        stage_key: 'sefaz_decisao', label: 'Análise da SEFAZ', sort_order: 20,
        description: 'Acompanhar a análise. “Protocolado” e “em análise” são a mesma situação; use “Aguardando ação do usuário” quando a bola estiver com o cliente.',
        allowedStatuses: DECISION_STATUSES,
        statusLabels: {
          pendente: 'Aguardando análise',
          em_andamento: 'Em análise',
          aprovado: 'Deferido',
          reprovado: 'Indeferido',
        },
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'ipva_recurso',
        fields: [
          { key: 'operational_status', label: 'Situação na SEFAZ', type: 'select', options: SEFAZ_STATUS_OPTIONS },
          { key: 'pending_user_action', label: 'O que o cliente precisa fazer', type: 'textarea', visibleWhen: { key: 'operational_status', equals: 'aguardando_acao_usuario' } },
          { key: 'decision_notified_at', label: 'Data da ciência da decisão', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea', visibleWhen: { key: RESULT_FIELD_KEY, equals: 'indeferido' } },
          { ...CLIENT_NOTIFIED_FIELD, visibleWhen: { key: RESULT_FIELD_KEY, equals: 'deferido' } },
        ],
      },
      {
        stage_key: 'ipva_recurso', label: 'Recurso', sort_order: 30,
        description: 'Liberada quando o IPVA é indeferido. O prazo de recurso costuma ser de 30 dias contados da ciência.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: [...STANDARD_STATUSES, 'aprovado', 'reprovado'],
        fields: [
          ...PROTOCOL_FIELDS,
          { key: 'due_date', label: 'Prazo registrado', type: 'date' },
          { key: 'grounds', label: 'Fundamentos e observações', type: 'textarea' },
          { key: 'outcome', label: 'Resultado do recurso', type: 'textarea' },
        ],
      },
      {
        stage_key: 'ipva_conclusao', label: 'Conclusão do IPVA', sort_order: 40,
        description: 'Registrar a isenção concedida, a validade informada e a comunicação ao cliente.',
        fields: [
          { key: 'exemption_start_date', label: 'Isenção válida a partir de', type: 'date' },
          { key: 'valid_until', label: 'Validade informada', type: 'date' },
          CLIENT_NOTIFIED_FIELD,
        ],
      },
    ],
  },

  emplacamento: {
    slug: 'emplacamento',
    title: 'Emplacamento do veículo',
    scopeNote: 'Fluxo logístico interno. Taxas, documentos e execução variam conforme DETRAN, veículo e responsável escolhido.',
    sources: [],
    stages: [
      {
        stage_key: 'responsavel_emplacamento', label: 'Definição do responsável', sort_order: 10,
        description: 'Registrar quem conduzirá o emplacamento.',
        fields: [{ key: 'responsible_party', label: 'Responsável pelo emplacamento', type: 'select', requiredOnResolve: true, options: [
          { value: 'eleva', label: 'Eleva' }, { value: 'concessionaria', label: 'Concessionária' }, { value: 'cliente', label: 'Cliente' },
        ] }],
      },
      {
        stage_key: 'documentos_emplacamento', label: 'Documentos e taxas', sort_order: 20,
        description: 'Aplicar quando o emplacamento estiver sob responsabilidade da Eleva.',
        checklist: [
          { key: 'nota_fiscal', label: 'Nota fiscal do veículo' },
          { key: 'documento_proprietario', label: 'Documento do proprietário' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'pagamento_taxas', label: 'Comprovantes de taxas' },
        ],
      },
      {
        stage_key: 'execucao_emplacamento', label: 'Execução do emplacamento', sort_order: 30,
        description: 'Acompanhar protocolo, placa e entrega.',
        fields: [
          { key: 'protocol', label: 'Protocolo/ordem de serviço', type: 'text' },
          { key: 'license_plate', label: 'Placa', type: 'text' },
          { key: 'completed_at', label: 'Data de conclusão', type: 'date', requiredOnResolve: true },
        ],
      },
      {
        stage_key: 'entrega_emplacamento', label: 'Entrega e comunicação', sort_order: 40,
        description: 'Confirmar entrega e comunicação ao cliente.',
        checklist: [
          { key: 'vehicle_released', label: 'Veículo/documentação liberados' },
          { key: 'client_notified', label: 'Cliente comunicado' },
        ],
      },
    ],
  },

  estacionamento: {
    slug: 'estacionamento',
    title: 'Credencial de estacionamento PCD',
    scopeNote: 'Priorizar emissão digital quando disponível; município/estado pode exigir fluxo próprio, laudo ou perícia.',
    sources: [
      { title: 'Senatran — Credencial de Estacionamento Digital', url: 'https://www.gov.br/pt-br/servicos/emitir-credencial-de-estacionamento-digital' },
    ],
    stages: [
      {
        stage_key: 'elegibilidade_estacionamento', label: 'Canal e elegibilidade', sort_order: 10,
        description: 'Definir o órgão emissor e se o cadastro nacional permite emissão digital.',
        fields: [
          { key: 'issuing_authority', label: 'Órgão/município emissor', type: 'text', requiredOnResolve: true },
          { key: 'channel', label: 'Canal', type: 'select', requiredOnResolve: true, options: [
            { value: 'cdt', label: 'Carteira Digital de Trânsito' }, { value: 'senatran_web', label: 'Portal Senatran' }, { value: 'municipal', label: 'Órgão municipal/estadual' },
          ] },
          { key: 'mobility_impairment', label: 'Comprometimento de mobilidade confirmado', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
          { key: 'specific_report_required', label: 'Órgão exige laudo específico?', type: 'select', options: YES_NO_OPTIONS },
        ],
      },
      {
        stage_key: 'documentos_estacionamento', label: 'Documentação', sort_order: 20,
        description: 'Checklist ajustável conforme o órgão emissor.',
        checklist: [
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'documento_pessoal', label: 'CNH ou documento de identificação' },
          { key: 'laudo', label: 'Laudo normal ou específico, quando exigido', requiredOnResolve: false },
          { key: 'representacao', label: 'Representação legal, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'solicitacao_estacionamento', label: 'Solicitação', sort_order: 30, entryStage: true,
        description: 'Registrar protocolo, data e situação.',
        fields: [...PROTOCOL_FIELDS, { key: 'operational_status', label: 'Situação', type: 'select', options: REQUEST_STATUS_OPTIONS }],
      },
      {
        stage_key: 'pericia_estacionamento', label: 'Perícia, quando exigida', sort_order: 40,
        description: 'Marcar como não aplicável quando o órgão não exigir perícia.',
        initialStatus: 'nao_aplicavel',
        hasScheduledDate: true,
        scheduledDateRequiredOnResolve: true,
        hasAttendance: true,
        resultOptions: [
          { value: 'favoravel', label: 'Favorável', stageStatus: 'aprovado' },
          { value: 'desfavoravel', label: 'Desfavorável', stageStatus: 'reprovado' },
        ],
      },
      {
        stage_key: 'decisao_estacionamento', label: 'Decisão', sort_order: 50,
        description: 'Registrar aprovação ou reprovação e definir eventual nova medida.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: [
          { value: 'aprovado', label: 'Aprovado', stageStatus: 'aprovado' },
          { value: 'reprovado', label: 'Reprovado', stageStatus: 'reprovado' },
        ],
        activateOnRejected: 'recurso_estacionamento',
        fields: [{ key: 'decision_notified_at', label: 'Data da ciência', type: 'date' }, { key: 'rejection_reason', label: 'Motivo', type: 'textarea' }],
      },
      {
        stage_key: 'recurso_estacionamento', label: 'Recurso ou nova solicitação', sort_order: 60,
        description: 'Usar somente após reprovação.',
        initialStatus: 'nao_aplicavel',
        fields: [
          { key: 'action', label: 'Providência', type: 'select', requiredOnResolve: true, options: [
            { value: 'recurso', label: 'Interpor recurso' }, { value: 'nova_solicitacao', label: 'Nova solicitação' }, { value: 'encerrar', label: 'Encerrar' },
          ] },
          { key: 'protocol', label: 'Número do novo protocolo/recurso', type: 'text' },
          { key: 'protocol_date', label: 'Data do novo protocolo/recurso', type: 'date' },
          { key: 'notes', label: 'Observações', type: 'textarea' },
        ],
      },
      {
        stage_key: 'emissao_estacionamento', label: 'Emissão da credencial', sort_order: 70,
        description: 'Registrar emissão, validade efetiva e comunicação ao cliente.',
        fields: [
          { key: 'credential_number', label: 'Identificador da credencial', type: 'text' },
          { key: 'issued_at', label: 'Data de emissão', type: 'date', requiredOnResolve: true },
          { key: 'valid_until', label: 'Validade indicada', type: 'date' },
          CLIENT_NOTIFIED_FIELD,
        ],
      },
    ],
  },

  cin: {
    slug: 'cin',
    title: 'Carteira de Identidade Nacional com informação de saúde',
    scopeNote: 'A inclusão de deficiência, símbolo ou CID é opcional, envolve dado sensível e depende das exigências do órgão de identificação civil.',
    sources: [
      { title: 'Governo Digital — deficiência na CIN', url: 'https://www.gov.br/governodigital/pt-br/identidade/identificacao-do-cidadao-e-carteira-de-identidade-nacional/perguntas-frequentes-sobre-a-cin/a-cin-podera-informar-que-possuo-algum-tipo-de-deficiencia' },
    ],
    stages: [
      {
        stage_key: 'definicao_cin', label: 'Definição da informação solicitada', sort_order: 10,
        description: 'Registrar somente o que o titular autorizou incluir.',
        fields: [
          { key: 'issuing_authority', label: 'Órgão de identificação civil', type: 'text', requiredOnResolve: true },
          { key: 'health_data_authorized', label: 'Titular autorizou inclusão da informação de saúde', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
          { key: 'requested_information', label: 'Símbolo, condição ou CID solicitado', type: 'textarea', requiredOnResolve: true, help: 'Dado pessoal sensível: registre apenas o necessário e autorizado.' },
        ],
      },
      {
        stage_key: 'documentos_cin', label: 'Documentação', sort_order: 20,
        description: 'Confirmar previamente os documentos aceitos pelo órgão emissor.',
        checklist: [
          { key: 'cpf_regular', label: 'CPF regular e conferido' },
          { key: 'certidao', label: 'Certidão/documento-base exigido para a CIN' },
          { key: 'laudo_especifico', label: 'Laudo exigido para a informação de saúde' },
          { key: 'consentimento', label: 'Autorização do titular registrada' },
        ],
      },
      {
        stage_key: 'agendamento_cin', label: 'Agendamento no órgão emissor', sort_order: 30,
        description: 'Registrar data e comparecimento.',
        hasScheduledDate: true,
        scheduledDateRequiredOnResolve: true,
        hasAttendance: true,
        fields: [{ key: 'location', label: 'Unidade/local', type: 'text' }],
      },
      {
        stage_key: 'emissao_cin', label: 'Emissão da CIN', sort_order: 40,
        description: 'O prazo deve ser informado pelo órgão; não presumir vinte dias.',
        fields: [
          { key: 'requested_at', label: 'Solicitada em', type: 'date', requiredOnResolve: true },
          { key: 'expected_at', label: 'Previsão informada', type: 'date' },
          { key: 'issued_at', label: 'Emitida em', type: 'date', requiredOnResolve: true },
          { key: 'valid_until', label: 'Validade impressa', type: 'date' },
        ],
      },
      {
        stage_key: 'entrega_cin', label: 'Entrega e conferência', sort_order: 50,
        description: 'Conferir a informação solicitada e comunicar o cliente.',
        checklist: [
          { key: 'information_checked', label: 'Informação/símbolo conferido na CIN' },
          { key: 'client_notified', label: 'Cliente comunicado' },
          { key: 'delivered', label: 'Documento entregue ou acesso digital orientado' },
        ],
      },
    ],
  },

  rodizio: {
    slug: 'rodizio',
    title: 'Isenção do Rodízio Municipal — São Paulo',
    scopeNote: 'Fluxo destinado ao cadastro de veículo no município de São Paulo. Tratamento em São Paulo e representação exigem documentação própria.',
    sources: [
      { title: 'Prefeitura de São Paulo — cadastro para isenção do rodízio', url: 'https://prefeitura.sp.gov.br/web/mobilidade/w/autorizacoes_especiais/isencao_de_rodizio/271800' },
    ],
    stages: [
      {
        stage_key: 'elegibilidade_rodizio', label: 'Elegibilidade e vínculo com São Paulo', sort_order: 10,
        description: 'Confirmar residência ou tratamento no município e o veículo transportador.',
        fields: [
          { key: 'eligibility_basis', label: 'Fundamento do pedido', type: 'select', requiredOnResolve: true, options: [
            { value: 'residente_sp', label: 'Reside no município de São Paulo' }, { value: 'tratamento_sp', label: 'Realiza tratamento em São Paulo' },
          ] },
          { key: 'vehicle_plate', label: 'Placa do veículo', type: 'text', requiredOnResolve: true },
          { key: 'vehicle_owner', label: 'Proprietário do veículo', type: 'text' },
        ],
      },
      {
        stage_key: 'documentos_rodizio', label: 'Documentação', sort_order: 20,
        description: 'Checklist base do SP156.',
        checklist: [
          { key: 'formulario', label: 'Formulário/requerimento aplicável' },
          { key: 'identificacao', label: 'Documento de identificação e CPF' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço ou vínculo com tratamento' },
          { key: 'documento_veiculo', label: 'Documento do veículo' },
          { key: 'laudo', label: 'Laudo/atestado exigido' },
          { key: 'representacao', label: 'Documento de representação, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'protocolo_rodizio', label: 'Solicitação no SP156', sort_order: 30, entryStage: true,
        description: 'Registrar protocolo e data sem armazenar credenciais.',
        fields: [...PROTOCOL_FIELDS, { key: 'operational_status', label: 'Situação', type: 'select', options: REQUEST_STATUS_OPTIONS }],
      },
      {
        stage_key: 'pendencias_rodizio', label: 'Análise e pendências', sort_order: 40,
        description: 'Consultar periodicamente e registrar exigências recebidas.',
        fields: [
          { key: 'last_checked_at', label: 'Última consulta', type: 'date', requiredOnResolve: true },
          { key: 'requirement_details', label: 'Pendência/exigência', type: 'textarea' },
          { key: 'requirement_resolved', label: 'Pendência sanada', type: 'boolean' },
        ],
      },
      {
        stage_key: 'decisao_rodizio', label: 'Decisão', sort_order: 50,
        description: 'Registrar resultado e validade informada pelo órgão.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: [
          { value: 'aprovado', label: 'Aprovado', stageStatus: 'aprovado' },
          { value: 'reprovado', label: 'Reprovado', stageStatus: 'reprovado' },
        ],
        fields: [
          { key: 'decision_notified_at', label: 'Data da ciência', type: 'date' },
          { key: 'valid_until', label: 'Validade informada', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo da reprovação', type: 'textarea' },
        ],
      },
      {
        stage_key: 'comunicacao_rodizio', label: 'Comunicação ao cliente', sort_order: 60,
        description: 'Orientar o cliente sobre o resultado e uso correto do cadastro.',
        fields: [CLIENT_NOTIFIED_FIELD, { key: 'guidance', label: 'Orientações enviadas', type: 'textarea' }],
      },
    ],
  },

  imposto_de_renda: {
    slug: 'imposto_de_renda',
    title: 'Isenção de IR por moléstia grave',
    scopeNote: 'A isenção alcança rendimentos de aposentadoria, pensão, reforma ou reserva; não torna automaticamente isentos salários, atividade autônoma ou aluguéis.',
    sources: [
      { title: 'Receita Federal — isenção por moléstia grave', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/molestia-grave' },
      { title: 'Receita Federal — condições para usufruir', url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/isencao/quais-as-condicoes-para-usufruir' },
    ],
    stages: [
      {
        stage_key: 'elegibilidade_ir', label: 'Elegibilidade da renda', sort_order: 10,
        description: 'Confirmar tipo de rendimento e doença prevista em lei antes de iniciar.',
        fields: [
          { key: 'income_type', label: 'Tipo de rendimento', type: 'select', requiredOnResolve: true, options: [
            { value: 'aposentadoria', label: 'Aposentadoria' }, { value: 'pensao', label: 'Pensão' }, { value: 'reforma_reserva', label: 'Reforma/reserva remunerada' }, { value: 'outro', label: 'Outro — revisar elegibilidade' },
          ] },
          { key: 'paying_source', label: 'Fonte pagadora', type: 'select', requiredOnResolve: true, options: [
            { value: 'inss', label: 'INSS' }, { value: 'spprev', label: 'SPPREV' }, { value: 'previdencia_privada', label: 'Previdência complementar' }, { value: 'outro', label: 'Outro órgão' },
          ] },
          { key: 'legal_condition', label: 'Doença/condição legal indicada no laudo', type: 'text', requiredOnResolve: true },
          { key: 'diagnosis_date', label: 'Data reconhecida da doença', type: 'date' },
        ],
      },
      {
        stage_key: 'documentos_ir', label: 'Documentação', sort_order: 20,
        description: 'O laudo deve ser de serviço médico oficial e indicar a data da doença quando possível.',
        checklist: [
          { key: 'identificacao_cpf', label: 'Documento de identificação e CPF' },
          { key: 'benefit_proof', label: 'Comprovante de aposentadoria/pensão/reforma' },
          { key: 'official_medical_report', label: 'Laudo de serviço médico oficial' },
          { key: 'medical_documents', label: 'Exames e documentos médicos de suporte' },
          { key: 'representacao', label: 'Procuração/representação, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'protocolo_ir', label: 'Solicitação à fonte pagadora', sort_order: 30, entryStage: true,
        description: 'Registrar o canal e protocolo do órgão responsável pelo pagamento.',
        fields: [
          { key: 'agency', label: 'Órgão', type: 'text', requiredOnResolve: true },
          { key: 'channel', label: 'Canal utilizado', type: 'text' },
          ...PROTOCOL_FIELDS,
          { key: 'operational_status', label: 'Situação', type: 'select', options: REQUEST_STATUS_OPTIONS },
        ],
      },
      {
        stage_key: 'pericia_ir', label: 'Perícia oficial, quando exigida', sort_order: 40,
        description: 'Marcar como não aplicável se o órgão decidir apenas com o laudo oficial apresentado.',
        initialStatus: 'nao_aplicavel',
        hasScheduledDate: true,
        scheduledDateRequiredOnResolve: true,
        hasAttendance: true,
        resultOptions: [
          { value: 'favoravel', label: 'Favorável', stageStatus: 'aprovado' },
          { value: 'desfavoravel', label: 'Desfavorável', stageStatus: 'reprovado' },
        ],
      },
      {
        stage_key: 'decisao_ir', label: 'Decisão administrativa', sort_order: 50,
        description: 'Registrar resultado, ciência e termo inicial reconhecido.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'revisao_ir',
        fields: [
          { key: 'decision_notified_at', label: 'Data da ciência', type: 'date' },
          { key: 'exemption_start_date', label: 'Termo inicial reconhecido', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea' },
        ],
      },
      {
        stage_key: 'efeitos_ir', label: 'Aplicação e valores anteriores', sort_order: 60,
        description: 'Confirmar retenção na fonte e avaliar declarações anteriores sem presumir restituição automática.',
        checklist: [
          { key: 'withholding_stopped', label: 'Fonte pagadora deixou de reter o IR' },
          { key: 'prior_years_reviewed', label: 'Anos anteriores revisados' },
          { key: 'returns_rectified', label: 'Declarações retificadas, quando cabível', requiredOnResolve: false },
          { key: 'refund_request_reviewed', label: 'Restituição/pedido de repetição avaliado', requiredOnResolve: false },
          { key: 'client_notified', label: 'Cliente comunicado' },
        ],
      },
      {
        stage_key: 'revisao_ir', label: 'Revisão, recurso ou via judicial', sort_order: 70,
        description: 'Etapa condicional após indeferimento; encaminhamento judicial exige decisão expressa do cliente.',
        initialStatus: 'nao_aplicavel',
        fields: [
          { key: 'action', label: 'Providência', type: 'select', requiredOnResolve: true, options: [
            { value: 'revisao_administrativa', label: 'Revisão/recurso administrativo' }, { value: 'judicial', label: 'Encaminhamento judicial' }, { value: 'encerrar', label: 'Encerrar' },
          ] },
          { key: 'referred', label: 'Encaminhado ao responsável', type: 'boolean' },
          { key: 'filed_at', label: 'Data do protocolo/ajuizamento', type: 'date' },
          { key: 'reference_number', label: 'Número do processo/protocolo', type: 'text' },
          { key: 'outcome', label: 'Resultado', type: 'textarea' },
        ],
      },
    ],
  },

  laudo: {
    slug: 'laudo',
    title: 'Obtenção de laudo médico',
    scopeNote: 'Fluxo interno genérico. O emissor, conteúdo e validade devem seguir a finalidade específica do laudo.',
    sources: [],
    stages: [
      {
        stage_key: 'definicao_laudo', label: 'Finalidade e emissor', sort_order: 10,
        description: 'Definir qual laudo é necessário antes de solicitar.',
        fields: [
          { key: 'purpose', label: 'Finalidade do laudo', type: 'text', requiredOnResolve: true },
          { key: 'issuer', label: 'Órgão/clínica emissora', type: 'text', requiredOnResolve: true },
          { key: 'requirements', label: 'Requisitos específicos', type: 'textarea' },
        ],
      },
      {
        stage_key: 'documentos_laudo', label: 'Documentos e exames', sort_order: 20,
        description: 'Reunir o material exigido pelo emissor.',
        checklist: [
          { key: 'identificacao', label: 'Documento de identificação' },
          { key: 'medical_history', label: 'Relatórios/exames médicos disponíveis' },
          { key: 'specific_form', label: 'Formulário específico, quando exigido', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'atendimento_laudo', label: 'Atendimento/perícia', sort_order: 30,
        description: 'Registrar agendamento e comparecimento.',
        hasScheduledDate: true,
        scheduledDateRequiredOnResolve: true,
        hasAttendance: true,
        fields: [{ key: 'location', label: 'Local', type: 'text' }],
      },
      {
        stage_key: 'emissao_laudo', label: 'Emissão e entrega', sort_order: 40,
        description: 'Conferir finalidade, emissão e validade efetivamente informada.',
        fields: [
          { key: 'issued_at', label: 'Data de emissão', type: 'date', requiredOnResolve: true },
          { key: 'valid_until', label: 'Validade indicada', type: 'date' },
          { key: 'delivered', label: 'Laudo entregue ao cliente/equipe', type: 'boolean', mustBeTrueOnResolve: true },
        ],
      },
    ],
  },
}

export const OPERATIONAL_WORKFLOW_SLUGS = Object.keys(WORKFLOWS)

export function getOperationalWorkflowDefinition(slug: string) {
  return WORKFLOWS[slug] ?? null
}

export function hasOperationalWorkflow(slug: string) {
  return Boolean(WORKFLOWS[slug])
}

export function getOperationalStageTemplate(slug: string, stageKey: string) {
  return WORKFLOWS[slug]?.stages.find(stage => stage.stage_key === stageKey) ?? null
}

export function getOperationalStageInitialData(stage: OperationalStageTemplate) {
  const fields = Object.fromEntries((stage.fields ?? []).map(field => [field.key, field.type === 'boolean' ? false : '']))
  const checklist = Object.fromEntries((stage.checklist ?? []).map(item => [item.key, false]))
  const initialData = { ...fields, ...(stage.initialData ?? {}) }
  return stage.checklist ? { ...initialData, checklist } : initialData
}

export function buildOperationalStageRows(processId: string, slug: string) {
  const workflow = getOperationalWorkflowDefinition(slug)
  if (!workflow) return []

  return workflow.stages.map(stage => ({
    process_id: processId,
    stage_key: stage.stage_key,
    label: stage.label,
    sort_order: stage.sort_order,
    status: stage.initialStatus ?? 'pendente' as OperationalStageStatus,
    data: getOperationalStageInitialData(stage),
  }))
}

function isResolvedStatus(status: string) {
  return ['concluido', 'aprovado', 'reprovado', 'nao_aplicavel'].includes(status)
}

export function isOperationalFieldVisible(
  field: OperationalFieldDefinition,
  data: Record<string, unknown>,
  result?: string | null,
) {
  if (!field.visibleWhen) return true
  if (field.visibleWhen.key === RESULT_FIELD_KEY) return (result ?? '') === field.visibleWhen.equals
  return data[field.visibleWhen.key] === field.visibleWhen.equals
}

/** Etapa em que a entrada é dada (protocolo). */
export function isEntryStage(template: OperationalStageTemplate) {
  return template.entryStage === true
}

export function validateOperationalStage(input: {
  template: OperationalStageTemplate
  status: string
  scheduledDate?: string | null
  attended?: boolean | null
  result?: string | null
  data: Record<string, unknown>
}) {
  if (!isResolvedStatus(input.status) || input.status === 'nao_aplicavel') return null

  if (input.template.scheduledDateRequiredOnResolve && !input.scheduledDate) {
    return 'Informe a data agendada antes de concluir esta etapa.'
  }
  if (input.template.hasAttendance && typeof input.attended !== 'boolean') {
    return 'Informe se o cliente compareceu antes de concluir esta etapa.'
  }
  if (input.template.resultOptions?.length && !input.result) {
    return 'Informe o resultado antes de concluir esta etapa.'
  }

  const missingField = (input.template.fields ?? []).find(field => {
    if (!isOperationalFieldVisible(field, input.data, input.result)) return false
    const value = input.data[field.key]
    if (field.mustBeTrueOnResolve) return value !== true
    if (!field.requiredOnResolve) return false
    return value === null || value === undefined || value === ''
  })
  if (missingField) return `Preencha “${missingField.label}” antes de concluir esta etapa.`

  const checklist = input.data.checklist && typeof input.data.checklist === 'object'
    ? input.data.checklist as Record<string, unknown>
    : {}
  const missingItem = (input.template.checklist ?? []).find(item => item.requiredOnResolve !== false && checklist[item.key] !== true)
  if (missingItem) return `Conclua o item “${missingItem.label}” antes de finalizar esta etapa.`

  return null
}
