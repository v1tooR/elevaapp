import type { VehicleCondition } from '@/types/database'

export interface IpvaVehicleInput {
  plate?: string | null
  renavam?: string | null
  brand?: string | null
  model?: string | null
  vehicleCondition: VehicleCondition
  invoiceIssuedAt?: string | null
}

/**
 * Placa e marca são o que o IPVA precisa para andar. Com os dois preenchidos o
 * processo é liberado, sem depender de IPI, ICMS ou perícia.
 */
export function canReleaseIpva(vehicle: IpvaVehicleInput): boolean {
  return Boolean(vehicle.plate?.trim() && vehicle.brand?.trim())
}

/** Nota fiscal só é exigida quando o veículo é zero-quilômetro. */
export function requiresInvoiceDate(vehicle: IpvaVehicleInput): boolean {
  return vehicle.vehicleCondition === 'zero_km' && !vehicle.invoiceIssuedAt?.trim()
}

export interface IpvaVehicleStage {
  status: 'em_andamento' | 'concluido'
  data: Record<string, string>
}

export function buildIpvaVehicleStage(vehicle: IpvaVehicleInput): IpvaVehicleStage {
  const data: Record<string, string> = {
    license_plate: vehicle.plate?.trim() ?? '',
    brand: vehicle.brand?.trim() ?? '',
    model: vehicle.model?.trim() ?? '',
    renavam: vehicle.renavam?.trim() ?? '',
    vehicle_condition: vehicle.vehicleCondition,
    invoice_issued_at: vehicle.invoiceIssuedAt?.trim() ?? '',
  }

  return {
    status: canReleaseIpva(vehicle) && !requiresInvoiceDate(vehicle) ? 'concluido' : 'em_andamento',
    data,
  }
}

export const IPVA_RELEASE_NOTE =
  'Veículo identificado (placa e marca). O IPVA foi liberado e segue independente dos demais serviços.'
