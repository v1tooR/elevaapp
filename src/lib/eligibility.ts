import type { ClientType, DisabilityType } from '@/types/database'

export type CnhSubflow = 'com_exame_pratico' | 'sem_exame_pratico'

// Visual e mental nunca podem dirigir — bloquear CNH Especial na UI
export function isNonDriverDisability(disability: DisabilityType): boolean {
  return disability === 'visual' || disability === 'mental'
}

export function canHaveCnhEspecial(
  clientType: ClientType | undefined | null,
  disability: DisabilityType | undefined | null,
): boolean {
  if (clientType !== 'condutor') return false
  if (!disability) return false
  return !isNonDriverDisability(disability)
}

// null = deficiência não permite CNH (visual/mental)
export function getCnhSubflow(disability: DisabilityType): CnhSubflow | null {
  if (isNonDriverDisability(disability)) return null
  if (disability === 'fisica') return 'com_exame_pratico'
  // monocular | auditiva | autismo
  return 'sem_exame_pratico'
}

// Código de restrição sugerido para exibição — editável na perícia
export function getSuggestedCnhRestriction(disability: DisabilityType): string | null {
  switch (disability) {
    case 'fisica':    return 'C a L'
    case 'auditiva':  return 'B ou X'
    case 'monocular': return 'X'
    default:          return null
  }
}
