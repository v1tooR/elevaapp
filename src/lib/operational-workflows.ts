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
}

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
  allowedStatuses?: OperationalStageStatus[]
  fields?: OperationalFieldDefinition[]
  checklist?: OperationalChecklistItem[]
  hasScheduledDate?: boolean
  scheduledDateRequiredOnResolve?: boolean
  hasAttendance?: boolean
  resultOptions?: OperationalResultOption[]
  activateOnRejected?: string
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
const REQUEST_STATUS_OPTIONS: OperationalFieldOption[] = [
  { value: 'nao_iniciado', label: 'Não iniciado' },
  { value: 'em_preparacao', label: 'Em preparação' },
  { value: 'protocolado', label: 'Protocolado' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'exigencia', label: 'Com exigência/pendência' },
  { value: 'deferido', label: 'Deferido' },
  { value: 'indeferido', label: 'Indeferido' },
]

const COMMON_DECISION_RESULTS: OperationalResultOption[] = [
  { value: 'deferido', label: 'Deferido', stageStatus: 'aprovado' },
  { value: 'indeferido', label: 'Indeferido', stageStatus: 'reprovado' },
]

const CLIENT_NOTIFIED_FIELD: OperationalFieldDefinition = {
  key: 'client_notified',
  label: 'Cliente comunicado',
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
        stage_key: 'laudo_ipi', label: 'Laudo para IPI', sort_order: 10,
        description: 'Confirmar origem, solicitação e emissão do laudo aceito para o pedido.',
        fields: [
          { key: 'issuer', label: 'Órgão emissor', type: 'select', requiredOnResolve: true, options: [
            { value: 'detran', label: 'DETRAN' }, { value: 'sus_conveniado', label: 'Serviço público ou conveniado ao SUS' }, { value: 'outro_oficial', label: 'Outro emissor oficial aceito' },
          ] },
          { key: 'requested_at', label: 'Data da solicitação', type: 'date' },
          { key: 'issued_at', label: 'Data de emissão', type: 'date', requiredOnResolve: true },
        ],
      },
      {
        stage_key: 'documentos_ipi', label: 'Documentos do pedido', sort_order: 20,
        description: 'Checklist base; a exigência final deve seguir o perfil do cliente no SISEN.',
        checklist: [
          { key: 'identificacao_cpf', label: 'Documento de identificação e CPF' },
          { key: 'laudo', label: 'Laudo aceito para IPI' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'condutores', label: 'Condutor(es) habilitado(s), quando o beneficiário não conduz', requiredOnResolve: false },
          { key: 'representacao_legal', label: 'Representação legal/procuração, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'protocolo_sisen_ipi', label: 'Protocolo no SISEN', sort_order: 30,
        description: 'Registrar o pedido sem armazenar senha ou credencial do portal.',
        fields: [
          ...PROTOCOL_FIELDS,
          { key: 'request_scope', label: 'Escopo do pedido', type: 'select', requiredOnResolve: true, options: [
            { value: 'ipi', label: 'Somente IPI' }, { value: 'ipi_iof', label: 'IPI e IOF' },
          ] },
          { key: 'operational_status', label: 'Situação no SISEN', type: 'select', options: REQUEST_STATUS_OPTIONS },
        ],
      },
      {
        stage_key: 'analise_receita_ipi', label: 'Análise da Receita Federal', sort_order: 40,
        description: 'Acompanhar análise, exigências e ciência da decisão.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'recurso_ipi',
        fields: [
          { key: 'requirement_details', label: 'Exigência ou pendência', type: 'textarea' },
          { key: 'decision_notified_at', label: 'Data da ciência da decisão', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea' },
        ],
      },
      {
        stage_key: 'recurso_ipi', label: 'Recurso administrativo', sort_order: 50,
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
      {
        stage_key: 'autorizacao_ipi', label: 'Autorização para compra', sort_order: 60,
        description: 'Registrar a autorização emitida e conferir as condições vigentes antes da nota fiscal.',
        fields: [
          { key: 'authorization_number', label: 'Número da autorização', type: 'text', requiredOnResolve: true },
          { key: 'issued_at', label: 'Emitida em', type: 'date', requiredOnResolve: true },
          { key: 'valid_until', label: 'Validade indicada', type: 'date' },
        ],
      },
      {
        stage_key: 'transicao_compra_icms', label: 'Compra e transição para ICMS', sort_order: 70,
        description: 'Organizar concessionária, nota fiscal e próximo benefício sem criar processos duplicados automaticamente.',
        fields: [
          { key: 'only_ipi', label: 'Cliente comprará somente com IPI?', type: 'select', requiredOnResolve: true, options: YES_NO_OPTIONS },
          { key: 'vehicle_price', label: 'Valor estimado do veículo', type: 'number' },
          { key: 'dealership', label: 'Concessionária', type: 'text' },
          { key: 'salesperson', label: 'Vendedor', type: 'text' },
          { key: 'invoice_requested', label: 'Nota fiscal solicitada', type: 'boolean' },
          { key: 'licensing_offered', label: 'Emplacamento oferecido', type: 'boolean' },
          CLIENT_NOTIFIED_FIELD,
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
        stage_key: 'protocolo_sisen_iof', label: 'Protocolo no SISEN', sort_order: 30,
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
        stage_key: 'pre_requisitos_icms', label: 'Pré-requisitos do ICMS', sort_order: 10,
        description: 'Confirmar autorização do IPI, veículo novo e jurisdição aplicável.',
        checklist: [
          { key: 'autorizacao_ipi', label: 'Autorização do IPI válida' },
          { key: 'laudo', label: 'Laudo aceito pela SEFAZ' },
          { key: 'veiculo_novo', label: 'Aquisição de veículo novo' },
        ],
        fields: [{ key: 'state', label: 'UF do pedido', type: 'text', requiredOnResolve: true }],
      },
      {
        stage_key: 'documentos_icms', label: 'Checklist de documentos', sort_order: 20,
        description: 'Checklist interno do PDF, sujeito às exigências do SIVEI e do perfil do cliente.',
        checklist: [
          { key: 'anexo_ii', label: 'Anexo II/requerimento aplicável' },
          { key: 'comprovante_renda', label: 'Comprovante de renda' },
          { key: 'forma_pagamento', label: 'Comprovante da forma de pagamento' },
          { key: 'comprovante_endereco', label: 'Comprovante de endereço' },
          { key: 'procuracao', label: 'Procuração, quando aplicável', requiredOnResolve: false },
        ],
      },
      {
        stage_key: 'dados_compra_icms', label: 'Concessionária e veículo', sort_order: 30,
        description: 'Identificar a operação antes do protocolo.',
        fields: [
          { key: 'dealership', label: 'Concessionária', type: 'text', requiredOnResolve: true },
          { key: 'salesperson', label: 'Vendedor', type: 'text' },
          { key: 'vehicle', label: 'Veículo/modelo', type: 'text' },
          { key: 'vehicle_price', label: 'Valor do veículo', type: 'number' },
        ],
      },
      {
        stage_key: 'protocolo_sivei_icms', label: 'Protocolo no SIVEI', sort_order: 40,
        description: 'Registrar protocolo e situação operacional.',
        fields: [...PROTOCOL_FIELDS, { key: 'operational_status', label: 'Situação', type: 'select', requiredOnResolve: true, options: REQUEST_STATUS_OPTIONS }, { key: 'requirement_details', label: 'Exigência/pendência', type: 'textarea' }],
      },
      {
        stage_key: 'decisao_icms', label: 'Decisão da SEFAZ', sort_order: 50,
        description: 'Registrar ciência, resultado e motivo.',
        allowedStatuses: DECISION_STATUSES,
        resultOptions: COMMON_DECISION_RESULTS,
        activateOnRejected: 'recurso_icms',
        fields: [
          { key: 'decision_notified_at', label: 'Data da ciência', type: 'date' },
          { key: 'rejection_reason', label: 'Motivo do indeferimento', type: 'textarea' },
          { key: 'documents_release_authorized', label: 'Cliente autorizou envio de documentos à concessionária', type: 'boolean' },
        ],
      },
      {
        stage_key: 'recurso_icms', label: 'Recurso ou novo protocolo', sort_order: 60,
        description: 'Controlar a providência adotada após indeferimento.',
        initialStatus: 'nao_aplicavel',
        allowedStatuses: [...STANDARD_STATUSES, 'aprovado', 'reprovado'],
        fields: [
          { key: 'action', label: 'Providência', type: 'select', requiredOnResolve: true, options: [
            { value: 'recurso', label: 'Interpor recurso' }, { value: 'novo_pedido', label: 'Dar entrada novamente' }, { value: 'encerrar', label: 'Encerrar sem nova medida' },
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
        stage_key: 'solicitacao_estacionamento', label: 'Solicitação', sort_order: 30,
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
        stage_key: 'protocolo_rodizio', label: 'Solicitação no SP156', sort_order: 30,
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
        stage_key: 'protocolo_ir', label: 'Solicitação à fonte pagadora', sort_order: 30,
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
  return stage.checklist ? { ...fields, checklist } : fields
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
