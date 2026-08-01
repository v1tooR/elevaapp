import type { LeadIntendedService } from '@/types/database'

export interface ServicePlanDefinition {
  service: LeadIntendedService
  sortOrder: number
  prerequisite: LeadIntendedService | null
  startsOnConversion: boolean
  availableToStart: boolean
  requiresVehicleBeforeStart: boolean
}

export function getServicePrerequisite(
  service: LeadIntendedService,
  selectedServices: readonly LeadIntendedService[],
): LeadIntendedService | null {
  if (service === 'ipi' && selectedServices.includes('cnh_especial')) return 'cnh_especial'
  if (service === 'icms' && selectedServices.includes('ipi')) return 'ipi'
  return null
}

export function buildServicePlanDefinitions(
  selectedServices: readonly LeadIntendedService[],
): ServicePlanDefinition[] {
  const uniqueServices = [...new Set(selectedServices)]
  const services = uniqueServices.includes('cnh_especial')
    ? [
        'cnh_especial' as const,
        ...uniqueServices.filter(service => service !== 'cnh_especial'),
      ]
    : uniqueServices

  return services.map((service, index) => {
    const prerequisite = getServicePrerequisite(service, services)
    const requiresVehicleBeforeStart = service === 'icms' || service === 'ipva'
    return {
      service,
      sortOrder: index + 1,
      prerequisite,
      startsOnConversion: index === 0 && !requiresVehicleBeforeStart,
      availableToStart: prerequisite === null,
      requiresVehicleBeforeStart,
    }
  })
}
