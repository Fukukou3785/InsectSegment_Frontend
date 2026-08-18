import { toTokyoIsoString } from "@/lib/experiment-session"

export type TaskType = "tutorial" | "experiment"
export type BodyPartKey = "head" | "thorax" | "abdomen" | "legs"
export type CorrectionMethod = "touch" | "box" | "manual"

export type CorrectionCounts = Record<
  BodyPartKey,
  Record<CorrectionMethod, number>
>

export type TaskMetrics = {
  taskType: TaskType
  taskId: string
  taskIndex: number
  imageName: string
  editorStartedAt: string
  editorStartedEpochMs: number
  editorCompletedAt?: string
  editorDurationMs?: number
  correctionCounts: CorrectionCounts
  resultStartedAt?: string
  resultStartedEpochMs?: number
  resultCompletedAt?: string
  resultViewDurationMs?: number
  friendMaskClickCounts: Record<string, number>
  structurePartClickCounts: Record<BodyPartKey, number>
}

const TASK_METRICS_STORAGE_KEY = "experimentTaskMetrics"
export const CURRENT_TASK_TYPE_STORAGE_KEY = "currentTaskType"

const createCorrectionCounts = (): CorrectionCounts => ({
  head: { touch: 0, box: 0, manual: 0 },
  thorax: { touch: 0, box: 0, manual: 0 },
  abdomen: { touch: 0, box: 0, manual: 0 },
  legs: { touch: 0, box: 0, manual: 0 },
})

const createStructurePartClickCounts = (): Record<BodyPartKey, number> => ({
  head: 0,
  thorax: 0,
  abdomen: 0,
  legs: 0,
})

export const getCurrentTaskType = (): TaskType =>
  sessionStorage.getItem(CURRENT_TASK_TYPE_STORAGE_KEY) === "tutorial"
    ? "tutorial"
    : "experiment"

export const setCurrentTaskType = (taskType: TaskType) => {
  sessionStorage.setItem(CURRENT_TASK_TYPE_STORAGE_KEY, taskType)
}

export const getCurrentTaskId = () =>
  (sessionStorage.getItem("imageName") ?? "").replace(/\.[^.]+$/, "")

export const readTaskMetrics = (): TaskMetrics | null => {
  try {
    const raw = sessionStorage.getItem(TASK_METRICS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TaskMetrics
    if (!parsed.taskId || !parsed.imageName || !parsed.editorStartedAt) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeTaskMetrics = (metrics: TaskMetrics) => {
  sessionStorage.setItem(TASK_METRICS_STORAGE_KEY, JSON.stringify(metrics))
  return metrics
}

export const beginEditorMetrics = () => {
  const taskType = getCurrentTaskType()
  const imageName = sessionStorage.getItem("imageName") ?? ""
  const taskId = imageName.replace(/\.[^.]+$/, "")
  const savedIndex = Number.parseInt(
    sessionStorage.getItem("currentSampleIndex") ?? "0",
    10,
  )
  const taskIndex =
    taskType === "tutorial"
      ? 0
      : Number.isFinite(savedIndex)
        ? savedIndex + 1
        : 1
  const existing = readTaskMetrics()

  if (
    existing &&
    existing.taskType === taskType &&
    existing.taskId === taskId &&
    !existing.editorCompletedAt
  ) {
    return existing
  }

  const now = new Date()
  return writeTaskMetrics({
    taskType,
    taskId,
    taskIndex,
    imageName,
    editorStartedAt: toTokyoIsoString(now),
    editorStartedEpochMs: now.getTime(),
    correctionCounts: createCorrectionCounts(),
    friendMaskClickCounts: {},
    structurePartClickCounts: createStructurePartClickCounts(),
  })
}

export const incrementCorrectionCount = (
  bodyPart: BodyPartKey,
  method: CorrectionMethod,
) => {
  const metrics = readTaskMetrics() ?? beginEditorMetrics()
  const updated: TaskMetrics = {
    ...metrics,
    correctionCounts: {
      ...metrics.correctionCounts,
      [bodyPart]: {
        ...metrics.correctionCounts[bodyPart],
        [method]: metrics.correctionCounts[bodyPart][method] + 1,
      },
    },
  }
  return writeTaskMetrics(updated)
}

export const completeEditorMetrics = () => {
  const metrics = readTaskMetrics() ?? beginEditorMetrics()
  const now = new Date()
  return writeTaskMetrics({
    ...metrics,
    editorCompletedAt: toTokyoIsoString(now),
    editorDurationMs: Math.max(0, now.getTime() - metrics.editorStartedEpochMs),
  })
}

export const beginResultMetrics = () => {
  const metrics = readTaskMetrics()
  if (!metrics) return null
  if (metrics.resultStartedAt && metrics.resultStartedEpochMs) return metrics

  const now = new Date()
  return writeTaskMetrics({
    ...metrics,
    resultStartedAt: toTokyoIsoString(now),
    resultStartedEpochMs: now.getTime(),
  })
}

export const incrementFriendMaskClick = (maskId: string) => {
  const metrics = readTaskMetrics() ?? beginResultMetrics()
  if (!metrics) return null
  return writeTaskMetrics({
    ...metrics,
    friendMaskClickCounts: {
      ...metrics.friendMaskClickCounts,
      [maskId]: (metrics.friendMaskClickCounts[maskId] ?? 0) + 1,
    },
  })
}

export const incrementStructurePartClick = (bodyPart: BodyPartKey) => {
  const metrics = readTaskMetrics() ?? beginResultMetrics()
  if (!metrics) return null
  return writeTaskMetrics({
    ...metrics,
    structurePartClickCounts: {
      ...metrics.structurePartClickCounts,
      [bodyPart]: metrics.structurePartClickCounts[bodyPart] + 1,
    },
  })
}

export const completeResultMetrics = () => {
  const metrics = readTaskMetrics() ?? beginResultMetrics()
  if (!metrics) return null
  const now = new Date()
  const startedEpochMs = metrics.resultStartedEpochMs ?? now.getTime()
  return writeTaskMetrics({
    ...metrics,
    resultCompletedAt: toTokyoIsoString(now),
    resultViewDurationMs: Math.max(0, now.getTime() - startedEpochMs),
  })
}

export const clearTaskMetrics = () => {
  sessionStorage.removeItem(TASK_METRICS_STORAGE_KEY)
}
