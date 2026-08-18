export const EXPERIMENT_ID = "pilot_v2_2026"
export const SYSTEM_VERSION = "1.1.0"
export const LOG_SCHEMA_VERSION = "1.0"

export const EXPERIMENT_SESSION_STORAGE_KEY = "experimentSession"

export const PARTICIPANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

export type ExperimentClientInfo = {
  viewport_width: number
  viewport_height: number
  device_pixel_ratio: number
  browser: string
  browser_version: string
  os: string
}

export type ExperimentSession = {
  schemaVersion: string
  experimentId: string
  systemVersion: string
  participantId: string
  sessionId: string
  startEventId: string
  startedAt: string
  status: "starting" | "active" | "completing"
  client: ExperimentClientInfo
  taskOrder?: string[]
  tutorialCompleted?: boolean
  completionEventId?: string
  completionEndedAt?: string
}

export const normalizeParticipantId = (value: string) => value.trim()

export const validateParticipantId = (value: string) => {
  const normalized = normalizeParticipantId(value)

  if (!normalized) {
    return "実験協力者IDを入力してください。"
  }

  if (normalized.length > 32) {
    return "実験協力者IDは32文字以内で入力してください。"
  }

  if (!PARTICIPANT_ID_PATTERN.test(normalized)) {
    return "半角英数字、ハイフン、アンダースコアだけを使ってください。"
  }

  return null
}

export const toTokyoIsoString = (date = new Date()) => {
  const tokyoOffsetMs = 9 * 60 * 60 * 1000
  return new Date(date.getTime() + tokyoOffsetMs)
    .toISOString()
    .replace("Z", "+09:00")
}

const detectBrowser = (userAgent: string) => {
  const candidates = [
    { name: "Edge", pattern: /Edg\/([\d.]+)/ },
    { name: "Chrome", pattern: /Chrome\/([\d.]+)/ },
    { name: "Firefox", pattern: /Firefox\/([\d.]+)/ },
    { name: "Safari", pattern: /Version\/([\d.]+).*Safari/ },
  ]

  for (const candidate of candidates) {
    const match = userAgent.match(candidate.pattern)
    if (match) {
      return {
        browser: candidate.name,
        browser_version: match[1],
      }
    }
  }

  return {
    browser: "Unknown",
    browser_version: "",
  }
}

const detectOs = (userAgent: string) => {
  if (/Windows NT/i.test(userAgent)) return "Windows"
  if (/Android/i.test(userAgent)) return "Android"
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS"
  if (/Mac OS X/i.test(userAgent)) return "macOS"
  if (/Linux/i.test(userAgent)) return "Linux"
  return "Unknown"
}

export const getExperimentClientInfo = (): ExperimentClientInfo => {
  const userAgent = navigator.userAgent
  const browser = detectBrowser(userAgent)

  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    browser: browser.browser,
    browser_version: browser.browser_version,
    os: detectOs(userAgent),
  }
}

export const readExperimentSession = (): ExperimentSession | null => {
  try {
    const raw = sessionStorage.getItem(EXPERIMENT_SESSION_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as ExperimentSession
    if (
      !parsed.participantId ||
      !parsed.sessionId ||
      !parsed.startEventId ||
      !parsed.startedAt
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export const writeExperimentSession = (session: ExperimentSession) => {
  sessionStorage.setItem(
    EXPERIMENT_SESSION_STORAGE_KEY,
    JSON.stringify(session),
  )
  sessionStorage.setItem("participantId", session.participantId)
  sessionStorage.setItem("sessionId", session.sessionId)
  sessionStorage.setItem("sessionStartedAt", session.startedAt)
}

export const createExperimentSession = (
  participantId: string,
): ExperimentSession => ({
  schemaVersion: LOG_SCHEMA_VERSION,
  experimentId: EXPERIMENT_ID,
  systemVersion: SYSTEM_VERSION,
  participantId: normalizeParticipantId(participantId),
  sessionId: crypto.randomUUID(),
  startEventId: crypto.randomUUID(),
  startedAt: toTokyoIsoString(),
  status: "starting",
  tutorialCompleted: false,
  client: getExperimentClientInfo(),
})

export const updateExperimentTaskOrder = (taskOrder: string[]) => {
  const session = readExperimentSession()
  if (!session) return null

  const updatedSession: ExperimentSession = {
    ...session,
    taskOrder,
  }
  writeExperimentSession(updatedSession)
  return updatedSession
}

export const markTutorialCompleted = () => {
  const session = readExperimentSession()
  if (!session) return null

  const updatedSession: ExperimentSession = {
    ...session,
    tutorialCompleted: true,
  }
  writeExperimentSession(updatedSession)
  return updatedSession
}
