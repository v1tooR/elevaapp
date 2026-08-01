export interface FinancialInstallmentInput {
  installment_number: number
  due_date: string
  amount: number
}

export function addMonthsToDateKey(dateKey: string, months: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const targetMonth = month - 1 + months
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate()
  const date = new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay)))
  return date.toISOString().slice(0, 10)
}

export function buildInstallmentSchedule(
  netAmount: number,
  installmentCount: number,
  firstDueDate: string,
): FinancialInstallmentInput[] {
  if (!Number.isFinite(netAmount) || netAmount <= 0) throw new Error('Valor liquido invalido.')
  if (!Number.isInteger(installmentCount) || installmentCount < 1) throw new Error('Quantidade de parcelas invalida.')

  const netInCents = Math.round(netAmount * 100)
  const baseInCents = Math.floor(netInCents / installmentCount)
  return Array.from({ length: installmentCount }, (_, index) => ({
    installment_number: index + 1,
    due_date: addMonthsToDateKey(firstDueDate, index),
    amount: (baseInCents + (index === installmentCount - 1
      ? netInCents - baseInCents * installmentCount
      : 0)) / 100,
  }))
}

export function calculateContractProfit({
  netAmount,
  received,
  costs,
  commissions,
}: {
  netAmount: number
  received: number
  costs: number
  commissions: number
}) {
  const estimatedProfit = netAmount - costs - commissions
  return {
    outstanding: Math.max(0, netAmount - received),
    estimatedProfit,
    marginPercentage: netAmount > 0 ? estimatedProfit / netAmount * 100 : 0,
  }
}
