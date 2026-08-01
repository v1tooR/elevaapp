interface StartableStage {
  stage_key: string
  sort_order: number
  status?: string
  data?: Record<string, unknown>
}

export function applyStartingStage<T extends StartableStage>(
  stages: readonly T[],
  startingStageKey: string | null | undefined,
): T[] {
  if (!startingStageKey) return [...stages]
  const selectedOrder = stages.find(stage => stage.stage_key === startingStageKey)?.sort_order
  if (selectedOrder == null) return [...stages]

  return stages.map(stage => {
    if (stage.status === 'nao_aplicavel') return stage
    if (stage.sort_order < selectedOrder) {
      return {
        ...stage,
        status: 'concluido',
        data: {
          ...(stage.data ?? {}),
          concluida_antes_da_eleva: true,
        },
      }
    }
    if (stage.sort_order === selectedOrder) {
      return { ...stage, status: 'em_andamento' }
    }
    return stage
  })
}
