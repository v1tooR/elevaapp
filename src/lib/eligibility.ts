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

export const ELIGIBILITY_RULES_VERSION = '2026-07-15'

export const ELIGIBILITY_PROCESS_SLUGS = [
  'cnh_especial',
  'processo_ipi',
  'processo_iof',
  'processo_icms',
  'processo_ipva',
] as const

export type EligibilityProcessSlug = (typeof ELIGIBILITY_PROCESS_SLUGS)[number]
export type CnhSubflow = 'com_exame_pratico' | 'sem_exame_pratico' | 'aguardando_pericia'

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
}

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

export function analyzeEligibility(input: EligibilityInput): EligibilityAnalysis | null {
  if (!isEligibilityProcess(input.processTypeSlug)) return null

  const reasons: string[] = []
  const missingInformation: string[] = []
  const recommendations: string[] = []
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

    if (!input.hasMedicalReport) {
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
      if (!input.disabilitySeverity) {
        missingInformation.push('Informar o grau funcional utilizado no laudo do IPVA.')
      }
      if (input.state === 'SP' && input.vehicleCondition === 'usado') {
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
  }
}

export function getEligibilityStatusCopy(status: EligibilityStatus) {
  return STATUS_COPY[status]
}
