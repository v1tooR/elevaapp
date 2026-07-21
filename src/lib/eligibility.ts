import type {
  AuthorizedDriver,
  ClientType,
  CnhStatus,
  DisabilitySeverity,
  DisabilityType,
  EligibilityStatus,
  MedicalAssessmentStatus,
  VehicleCondition,
} from '@/types/database'

export const ELIGIBILITY_RULES_VERSION = '2026-07-20-imesc'

export const ELIGIBILITY_PROCESS_SLUGS = [
  'cnh_especial',
  'processo_ipi',
  'processo_iof',
  'processo_icms',
  'processo_ipva',
] as const

export type EligibilityProcessSlug = (typeof ELIGIBILITY_PROCESS_SLUGS)[number]
export type CnhSubflow = 'com_exame_pratico' | 'sem_exame_pratico' | 'aguardando_pericia'
export type ImescStatus =
  | 'nao_iniciado'
  | 'agendado'
  | 'pericia_realizada'
  | 'laudo_disponivel'
  | 'laudo_anterior_reaproveitado'
  | 'dispensa_documentada'
export type ImescSeverity = DisabilitySeverity | 'sem_deficiencia'
export type SefazIpvaStatus =
  | 'nao_protocolado'
  | 'em_analise'
  | 'deferido'
  | 'deferido_com_condicao'
  | 'indeferido'
  | 'recurso_em_andamento'

export interface CnhAssessmentInput {
  clientType?: ClientType | null
  medicalAssessmentStatus?: MedicalAssessmentStatus | null
  requiresPracticalExam?: boolean | null
}

export interface EligibilityInput {
  processTypeSlug: string
  state?: string | null
  vehicleCondition?: VehicleCondition | null
  clientType?: ClientType | null
  disabilityType?: DisabilityType | null
  disabilityTypes?: DisabilityType[] | null
  disabilitySeverity?: DisabilitySeverity | null
  cnhStatus?: CnhStatus | null
  cnhRestrictions?: string[] | null
  medicalAssessmentStatus?: MedicalAssessmentStatus | null
  requiresAdaptedVehicle?: boolean | null
  requiresPracticalExam?: boolean | null
  hasMedicalReport?: boolean | null
  authorizedDrivers?: AuthorizedDriver[] | null
  imescStatus?: ImescStatus | null
  imescReportIssuedAt?: string | null
  imescSeverity?: ImescSeverity | null
  sefazIpvaStatus?: SefazIpvaStatus | null
  sefazDecisionNotifiedAt?: string | null
  ipvaAppealFiledAt?: string | null
  ipvaAppealProtocol?: string | null
  analysisDate?: string | null
}

export interface EligibilitySource {
  title: string
  url: string
}

export interface EligibilityAnalysis {
  status: EligibilityStatus
  title: string
  summary: string
  reasons: string[]
  missingInformation: string[]
  recommendations: string[]
  requiresHumanReview: true
  rulesVersion: string
  sources: EligibilitySource[]
}

const IMESC_OFFICIAL_SOURCES: EligibilitySource[] = [
  {
    title: 'Decreto SP nº 66.470/2022, atualizado pelo Decreto nº 70.090/2025',
    url: 'https://legislacao.fazenda.sp.gov.br/Paginas/Decreto-66470-de-2022.aspx',
  },
  {
    title: 'Serviço oficial de perícias para isenção de IPVA — IMESC',
    url: 'https://servicos.sp.gov.br/fcarta/3C4779FC-E809-4E3E-926C-173D1770F9CA',
  },
  {
    title: 'Orientações após o protocolo do pedido — SEFAZ-SP',
    url: 'https://portal.fazenda.sp.gov.br/servicos/ipva/Paginas/Fiz-o-protocolo-do-pedido-de-isen%C3%A7%C3%A3o-PCD-mas-o-que-fa%C3%A7o-agora.aspx',
  },
]

const STATUS_COPY: Record<EligibilityStatus, { title: string; summary: string }> = {
  pre_elegivel: {
    title: 'Pré-elegível',
    summary: 'Os critérios iniciais cadastrados são compatíveis com o processo, sujeito à conferência documental.',
  },
  pendente_informacoes: {
    title: 'Pendente de informações',
    summary: 'Ainda faltam dados para realizar uma triagem confiável.',
  },
  requer_validacao: {
    title: 'Requer validação',
    summary: 'O caso depende de avaliação pericial, documental ou da regra vigente na UF.',
  },
  provavelmente_nao_elegivel: {
    title: 'Provavelmente não elegível',
    summary: 'Há um impedimento inicial conhecido, mas a conclusão deve ser revisada por uma pessoa responsável.',
  },
  elegibilidade_confirmada: {
    title: 'Elegibilidade confirmada',
    summary: 'A equipe confirmou a elegibilidade após conferência documental.',
  },
}

export function isEligibilityProcess(slug: string): slug is EligibilityProcessSlug {
  return ELIGIBILITY_PROCESS_SLUGS.includes(slug as EligibilityProcessSlug)
}

/**
 * Indica somente se faz sentido abrir uma análise de CNH com restrições.
 * A função não determina aptidão para dirigir com base no diagnóstico.
 */
export function canHaveCnhEspecial(
  clientType: ClientType | undefined | null,
  disability: DisabilityType | undefined | null,
): boolean {
  return clientType === 'condutor' && Boolean(disability)
}

/**
 * O exame prático depende da decisão pericial e das restrições motoras,
 * nunca apenas do nome da deficiência.
 */
export function getCnhSubflow(input: CnhAssessmentInput): CnhSubflow | null {
  if (input.clientType !== 'condutor') return null
  if (input.requiresPracticalExam === true) return 'com_exame_pratico'
  if (input.requiresPracticalExam === false) return 'sem_exame_pratico'
  return 'aguardando_pericia'
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function hasAuthorizedDriver(drivers?: AuthorizedDriver[] | null): boolean {
  return Boolean(drivers?.some(driver => (driver.name ?? '').trim() && (driver.cnh ?? '').trim()))
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addUtcYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() + years)
  return result
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

function getAnalysisDate(value?: string | null): Date {
  return parseDateOnly(value) ?? parseDateOnly(new Date().toISOString().slice(0, 10))!
}

export function analyzeEligibility(input: EligibilityInput): EligibilityAnalysis | null {
  if (!isEligibilityProcess(input.processTypeSlug)) return null

  const reasons: string[] = []
  const missingInformation: string[] = []
  const recommendations: string[] = []
  const sources: EligibilitySource[] = []
  let likelyBlocker = false
  let mandatoryValidation = false

  const disabilityTypes = unique([
    ...(input.disabilityType ? [input.disabilityType] : []),
    ...(input.disabilityTypes ?? []),
  ]) as DisabilityType[]

  if (!input.clientType) missingInformation.push('Informar se o cliente é condutor ou não condutor.')
  if (disabilityTypes.length === 0) missingInformation.push('Informar ao menos um tipo de deficiência ou condição.')

  if (input.processTypeSlug === 'cnh_especial') {
    if (input.clientType === 'nao_condutor') {
      likelyBlocker = true
      reasons.push('O beneficiário foi cadastrado como não condutor; ele próprio não necessita de processo de CNH.')
      recommendations.push('Cadastre as CNHs dos condutores autorizados nos processos de benefício aplicáveis.')
    } else if (input.clientType === 'condutor') {
      const subflow = getCnhSubflow({
        clientType: input.clientType,
        medicalAssessmentStatus: input.medicalAssessmentStatus,
        requiresPracticalExam: input.requiresPracticalExam,
      })

      if (subflow === 'aguardando_pericia') {
        mandatoryValidation = true
        reasons.push('A necessidade de exame prático ainda não foi definida pela avaliação médico-pericial.')
        recommendations.push('Registre o resultado pericial e as restrições efetivamente determinadas no RENACH/CNH.')
      } else if (subflow === 'com_exame_pratico') {
        reasons.push('A avaliação cadastrada determinou a realização de exame prático.')
      } else if (subflow === 'sem_exame_pratico') {
        reasons.push('A avaliação cadastrada não determinou exame prático.')
      }
    }
  } else {
    if (!input.vehicleCondition) {
      missingInformation.push('Informar se o veículo é zero-quilômetro ou usado.')
    }

    const hasSpecificImescReport =
      input.processTypeSlug === 'processo_ipva' &&
      input.state?.trim().toUpperCase() === 'SP' &&
      ['laudo_disponivel', 'laudo_anterior_reaproveitado', 'dispensa_documentada'].includes(input.imescStatus ?? '')

    if (!input.hasMedicalReport && !hasSpecificImescReport) {
      missingInformation.push('Confirmar a existência do laudo exigido para o benefício.')
    }

    if (['processo_icms', 'processo_ipva'].includes(input.processTypeSlug) && !input.state) {
      missingInformation.push('Informar a UF responsável pelo processo.')
    }

    if (input.clientType === 'nao_condutor' && !hasAuthorizedDriver(input.authorizedDrivers)) {
      missingInformation.push('Cadastrar ao menos um condutor autorizado com CNH.')
    }

    if (
      ['processo_ipi', 'processo_iof', 'processo_icms'].includes(input.processTypeSlug) &&
      input.vehicleCondition === 'usado'
    ) {
      likelyBlocker = true
      reasons.push('O benefício selecionado é normalmente vinculado à aquisição de veículo novo, não a veículo usado.')
      recommendations.push('Confirme se o processo correto não é IPVA ou outra providência relativa ao veículo usado.')
    }

    if (input.processTypeSlug === 'processo_ipi') {
      if (input.clientType === 'nao_condutor') {
        reasons.push('A ausência de CNH do beneficiário não impede, por si só, o pedido de IPI como não condutor.')
      }
      if (disabilityTypes.includes('monocular')) {
        mandatoryValidation = true
        reasons.push('Visão monocular, isoladamente, não confirma o enquadramento nos critérios visuais do IPI.')
        recommendations.push('Validar acuidade e campo visual conforme o laudo específico do benefício.')
      }
    }

    if (input.processTypeSlug === 'processo_iof') {
      if (disabilityTypes.length > 0 && !disabilityTypes.includes('fisica')) {
        likelyBlocker = true
        reasons.push('A triagem federal do IOF veicular é restrita à deficiência física.')
      }
      if (input.clientType === 'nao_condutor') {
        likelyBlocker = true
        reasons.push('O IOF veicular exige que o próprio beneficiário seja condutor habilitado.')
      }
      if (input.clientType === 'condutor' && input.cnhStatus !== 'com_restricoes') {
        if (input.cnhStatus === 'em_regularizacao' || !input.cnhStatus) {
          missingInformation.push('Concluir ou confirmar a CNH com restrições antes da análise do IOF.')
        } else {
          likelyBlocker = true
          reasons.push('Não há CNH com restrições registrada para o beneficiário condutor.')
        }
      }
    }

    if (input.processTypeSlug === 'processo_icms') {
      mandatoryValidation = true
      reasons.push('O ICMS depende do convênio e dos procedimentos adotados pela UF responsável.')
    }

    if (input.processTypeSlug === 'processo_ipva') {
      mandatoryValidation = true
      reasons.push('O IPVA depende dos critérios e procedimentos da UF responsável.')
      const state = input.state?.trim().toUpperCase()

      if (state === 'SP') {
        sources.push(...IMESC_OFFICIAL_SOURCES)
        reasons.push('Em São Paulo, o laudo regulamentado pelo IMESC subsidia o pedido, mas a decisão sobre a isenção é da SEFAZ.')

        if (!input.imescStatus) {
          missingInformation.push('Informar a situação da perícia ou do laudo IMESC.')
          recommendations.push('Verifique no portal do IMESC se a perícia precisa ser agendada ou se existe reaproveitamento/dispensa formalmente documentado.')
        } else if (input.imescStatus === 'nao_iniciado') {
          missingInformation.push('Iniciar o fluxo da perícia IMESC ou documentar a hipótese de reaproveitamento/dispensa aplicável.')
        } else if (input.imescStatus === 'agendado') {
          reasons.push('A perícia IMESC foi informada como agendada; ainda não há classificação pericial para a triagem.')
          recommendations.push('Registrar a data da perícia e, depois do atendimento, acompanhar a disponibilização do laudo.')
        } else if (input.imescStatus === 'pericia_realizada') {
          reasons.push('A perícia IMESC foi realizada e o laudo ainda está pendente de registro.')
          missingInformation.push('Registrar a data, a classificação e o identificador do laudo quando ele estiver disponível.')
        } else if (input.imescStatus === 'laudo_anterior_reaproveitado') {
          reasons.push('Foi informado o reaproveitamento de laudo anterior; essa hipótese deve permanecer vinculada ao mesmo veículo e ao fundamento documental correspondente.')
          recommendations.push('Confirme que o reaproveitamento atende ao artigo 2º do Decreto SP nº 66.470/2022.')
        } else if (input.imescStatus === 'dispensa_documentada') {
          reasons.push('Foi informada dispensa de nova perícia; a triagem não presume a dispensa sem o respectivo fundamento oficial.')
          recommendations.push('Anexe ou descreva o ato/documento que autorizou a dispensa da nova perícia.')
        }

        if (['laudo_disponivel', 'laudo_anterior_reaproveitado'].includes(input.imescStatus ?? '')) {
          if (!input.imescSeverity) {
            missingInformation.push('Informar a classificação exatamente como consta no laudo IMESC.')
          }
        }

        if (input.imescStatus === 'laudo_disponivel') {
          const issuedAt = parseDateOnly(input.imescReportIssuedAt)
          if (!issuedAt) {
            missingInformation.push('Informar a data de emissão do laudo IMESC para verificar sua validade.')
          } else {
            const validUntil = addUtcYears(issuedAt, 5)
            const analysisDate = getAnalysisDate(input.analysisDate)
            if (analysisDate > validUntil) {
              missingInformation.push(`O laudo informado ultrapassou a validade geral de 5 anos em ${formatDateOnly(validUntil)}.`)
              recommendations.push('Verifique a necessidade de novo laudo ou a existência de exceção formal para condição irreversível.')
            } else {
              reasons.push(`Pela regra geral informada, o laudo permanece dentro do prazo de 5 anos até ${formatDateOnly(validUntil)}.`)
            }
          }
        }

        if (input.imescSeverity === 'sem_deficiencia') {
          likelyBlocker = true
          reasons.push('O laudo foi informado como inexistência de deficiência, o que impede o enquadramento inicial do pedido.')
          recommendations.push('Se houver fundamento e posterior indeferimento, a regra vigente admite recurso com pedido de revisão do laudo.')
        } else if (input.imescSeverity === 'leve') {
          reasons.push('O grau leve não atende à regra geral, mas a lei prevê análise excepcional quando houver restrição relevante à participação social.')
          recommendations.push('Submeta o caso à revisão humana e preserve os documentos funcionais; não conclua a inelegibilidade apenas pelo rótulo "leve".')
        } else if (['moderada', 'grave', 'gravissima'].includes(input.imescSeverity ?? '')) {
          reasons.push('A classificação informada é compatível com os graus previstos na regra geral, sem substituir a decisão da SEFAZ.')
        }

        if (!input.sefazIpvaStatus) {
          missingInformation.push('Informar a situação do pedido de isenção na SEFAZ/SIVEI.')
        } else if (input.sefazIpvaStatus === 'nao_protocolado') {
          missingInformation.push('Protocolar o pedido de isenção no SIVEI dentro do prazo aplicável ao veículo.')
        } else if (input.sefazIpvaStatus === 'em_analise') {
          reasons.push('O pedido foi informado como em análise pela SEFAZ; o protocolo suspende a cobrança nas condições divulgadas pelo órgão.')
        } else if (input.sefazIpvaStatus === 'deferido') {
          reasons.push('A decisão da SEFAZ foi informada como deferida; a confirmação interna deve reproduzir a decisão e os dados do veículo.')
        } else if (input.sefazIpvaStatus === 'deferido_com_condicao') {
          reasons.push('A SEFAZ foi informada como deferida com condição; é necessário registrar e acompanhar a condição aplicada ao veículo.')
        } else if (input.sefazIpvaStatus === 'recurso_em_andamento') {
          reasons.push('Há recurso de IPVA em andamento; a elegibilidade não deve ser encerrada antes da decisão final.')
        } else if (input.sefazIpvaStatus === 'indeferido') {
          const notifiedAt = parseDateOnly(input.sefazDecisionNotifiedAt)
          const appealFiledAt = parseDateOnly(input.ipvaAppealFiledAt)

          if (!notifiedAt) {
            missingInformation.push('Informar a data da ciência do indeferimento para controlar o prazo recursal de 30 dias.')
          } else {
            const appealDueAt = addUtcDays(notifiedAt, 30)
            const analysisDate = getAnalysisDate(input.analysisDate)
            reasons.push(`O prazo recursal de 30 dias, contado da ciência informada, termina em ${formatDateOnly(appealDueAt)}.`)

            if (!appealFiledAt && analysisDate > appealDueAt) {
              likelyBlocker = true
              reasons.push('Não há protocolo de recurso registrado e o prazo calculado está vencido.')
            } else if (!appealFiledAt) {
              recommendations.push('Avaliar e, se cabível, protocolar o recurso antes do prazo calculado, com razões e documentos de suporte.')
            }
          }

          if (appealFiledAt) {
            reasons.push(`O recurso foi informado como protocolado em ${formatDateOnly(appealFiledAt)}.`)
            if (!input.ipvaAppealProtocol?.trim()) {
              missingInformation.push('Registrar o número do protocolo do recurso de IPVA.')
            }
          } else if (!likelyBlocker) {
            likelyBlocker = true
            reasons.push('A decisão vigente foi informada como indeferida e ainda não há recurso protocolado.')
          }
        }
      } else if (!input.disabilitySeverity) {
        missingInformation.push('Informar o grau funcional utilizado no laudo do IPVA.')
      }

      if (state === 'SP' && input.vehicleCondition === 'usado') {
        reasons.push('Em São Paulo, o IPVA do ano do pedido para veículo usado deve ser considerado no planejamento.')
      }
    }

    if (input.clientType === 'condutor' && !input.cnhStatus) {
      missingInformation.push('Informar a situação atual da CNH do beneficiário.')
    }

    if (input.cnhStatus === 'com_restricoes' && !(input.cnhRestrictions?.length)) {
      missingInformation.push('Registrar os códigos que constam efetivamente na CNH.')
    }
  }

  let status: EligibilityStatus
  if (likelyBlocker) {
    status = 'provavelmente_nao_elegivel'
  } else if (missingInformation.length > 0) {
    status = 'pendente_informacoes'
  } else if (mandatoryValidation) {
    status = 'requer_validacao'
  } else {
    status = 'pre_elegivel'
  }

  const copy = STATUS_COPY[status]
  return {
    status,
    title: copy.title,
    summary: copy.summary,
    reasons: unique(reasons),
    missingInformation: unique(missingInformation),
    recommendations: unique(recommendations),
    requiresHumanReview: true,
    rulesVersion: ELIGIBILITY_RULES_VERSION,
    sources: unique(sources.map(source => `${source.title}|${source.url}`)).map(value => {
      const [title, url] = value.split('|')
      return { title, url }
    }),
  }
}

export function getEligibilityStatusCopy(status: EligibilityStatus) {
  return STATUS_COPY[status]
}
